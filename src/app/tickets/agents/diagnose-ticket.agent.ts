import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { AiResponseSchema, IAiClient } from '../../../ai/ai.interface';
import { TrackAiUsage } from '../../../metrics/track-ai-usage.decorator';
import { Resilient } from '../../../resilience';
import type { TicketSelect } from '../../../schema/tickets.schema';

const DIAGNOSE_TICKET_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    diagnosis: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['diagnosis', 'confidence'],
};

const DIAGNOSE_TICKET_RESPONSE_SCHEMA = z.object({
  diagnosis: z.string(),
  confidence: z.number().min(0).max(1),
});

export type DiagnoseTicketResponse = z.infer<typeof DIAGNOSE_TICKET_RESPONSE_SCHEMA>;

const SYSTEM_PROMPT =
  'You are a Diagnosis agent for a customer support triage system. You are given a ticket and a set ' +
  'of knowledge-base article excerpts already retrieved for it by hybrid search, you do not have ' +
  'tools of your own. Synthesize them into a single diagnosis of what is actually wrong, grounded ' +
  'only in the retrieved excerpts, with a confidence between 0 and 1. If the excerpts do not clearly ' +
  'explain the ticket, say so plainly and give a low confidence rather than guessing.';

@Injectable()
export class DiagnoseTicketAgent {
  constructor(@Inject(AI_CLIENT) private readonly aiClient: IAiClient) {}

  @TrackAiUsage('TICKET_DIAGNOSE')
  @Resilient({ options: { timeoutMs: 30_000 } })
  async diagnose(ticket: TicketSelect, kbFindings: string): Promise<DiagnoseTicketResponse> {
    const prompt =
      `${SYSTEM_PROMPT}\n\n` +
      `Subject: ${ticket.subject}\n` +
      `Description: ${ticket.description ?? '(none provided)'}\n\n` +
      `Retrieved knowledge-base excerpts:\n${kbFindings}`;

    const raw = await this.aiClient.generateStructured(prompt, DIAGNOSE_TICKET_SCHEMA);

    try {
      return DIAGNOSE_TICKET_RESPONSE_SCHEMA.parse(raw);
    } catch (err) {
      throw new InternalServerErrorException('Diagnose Ticket agent returned a malformed response', { cause: err });
    }
  }
}
