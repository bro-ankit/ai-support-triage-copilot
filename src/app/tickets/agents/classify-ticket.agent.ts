import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { AiResponseSchema, IAiClient } from '../../../ai/ai.interface';
import { TrackAiUsage } from '../../../metrics/track-ai-usage.decorator';
import { Resilient } from '../../../resilience';
import { TICKET_CATEGORIES } from '../../../schema/ticket-classifications.schema';
import { TICKET_PRIORITIES } from '../../../schema/tickets.schema';
import type { TicketSelect } from '../../../schema/tickets.schema';

const CLASSIFY_TICKET_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    category: { type: 'string' },
    priority: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['category', 'priority', 'confidence'],
};

const CLASSIFY_TICKET_RESPONSE_SCHEMA = z.object({
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
  confidence: z.number().min(0).max(1),
});

export type ClassifyTicketResponse = z.infer<typeof CLASSIFY_TICKET_RESPONSE_SCHEMA>;

const SYSTEM_PROMPT =
  'You are a Ticket Classification agent for a customer support triage system. Given a ticket\'s ' +
  `subject, description, and any text extracted from attached screenshots or voice notes, classify it ` +
  `into one category (${TICKET_CATEGORIES.join(', ')}) and one priority ` +
  `(${TICKET_PRIORITIES.join(', ')}), with a confidence between 0 and 1. Base priority on customer ` +
  'impact and urgency, not on how the customer phrases the request.';

@Injectable()
export class ClassifyTicketAgent {
  constructor(@Inject(AI_CLIENT) private readonly aiClient: IAiClient) {}

  @TrackAiUsage('TICKET_CLASSIFY')
  @Resilient({ options: { timeoutMs: 30_000 } })
  async classify(ticket: TicketSelect, attachmentText: string): Promise<ClassifyTicketResponse> {
    const prompt =
      `${SYSTEM_PROMPT}\n\n` +
      `Subject: ${ticket.subject}\n` +
      `Description: ${ticket.description ?? '(none provided)'}\n` +
      `Attachment text: ${attachmentText || '(none)'}`;

    const raw = await this.aiClient.generateStructured(prompt, CLASSIFY_TICKET_SCHEMA);

    try {
      return CLASSIFY_TICKET_RESPONSE_SCHEMA.parse(raw);
    } catch (err) {
      throw new InternalServerErrorException('Classify Ticket agent returned a malformed response', { cause: err });
    }
  }
}
