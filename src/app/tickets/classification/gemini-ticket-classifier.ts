import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { AiResponseSchema, IAiClient } from '../../../ai/ai.interface';
import { TrackAiUsage } from '../../../metrics/track-ai-usage.decorator';
import { Resilient } from '../../../resilience';
import type { TicketSelect } from '../../../schema/tickets.schema';
import { Traced } from '../../../tracing/traced.decorator';
import { ClassifyTicketPromptUtil } from './classify-ticket-prompt.util';
import { CLASSIFY_TICKET_RESPONSE_SCHEMA, CLASSIFY_TICKET_SYSTEM_PROMPT, type ClassifyTicketResponse } from './ticket-classification.contract';
import type { ITicketClassifier } from './ticket-classifier.interface';

const CLASSIFY_TICKET_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    category: { type: 'string' },
    priority: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['category', 'priority', 'confidence'],
};

@Injectable()
export class GeminiTicketClassifier implements ITicketClassifier {
  readonly name = 'gemini';

  constructor(@Inject(AI_CLIENT) private readonly aiClient: IAiClient) { }

  @Traced<[TicketSelect, string], ClassifyTicketResponse>(
    'classify.gemini',
    (ticket) => ({ 'ticket.id': ticket.id, 'classifier.source': 'gemini' }),
    (result) => ({ 'classification.category': result.category, 'classification.priority': result.priority }),
  )
  @TrackAiUsage('TICKET_CLASSIFY')
  @Resilient({ options: { timeoutMs: 30_000 } })
  async classify(ticket: TicketSelect, attachmentText: string): Promise<ClassifyTicketResponse> {
    const userContent = ClassifyTicketPromptUtil.buildUserContent(ticket, attachmentText);
    const raw = await this.aiClient.generateStructured(CLASSIFY_TICKET_SYSTEM_PROMPT, userContent, CLASSIFY_TICKET_SCHEMA);

    try {
      return CLASSIFY_TICKET_RESPONSE_SCHEMA.parse(raw);
    } catch (err) {
      throw new InternalServerErrorException('Gemini ticket classifier returned a malformed response', { cause: err });
    }
  }
}
