import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { OllamaClassifierClient } from '../../../ai/ollama/ollama-classifier.client';
import type { TicketSelect } from '../../../schema/tickets.schema';
import { ClassifyTicketPromptUtil } from './classify-ticket-prompt.util';
import { CLASSIFY_TICKET_RESPONSE_SCHEMA, CLASSIFY_TICKET_SYSTEM_PROMPT, type ClassifyTicketResponse } from './ticket-classification.contract';
import type { ITicketClassifier } from './ticket-classifier.interface';

@Injectable()
export class OllamaTicketClassifier implements ITicketClassifier {
  readonly name = 'fine-tuned';

  constructor(
    @InjectPinoLogger(OllamaTicketClassifier.name) private readonly logger: PinoLogger,
    private readonly ollamaClassifierClient: OllamaClassifierClient,
  ) { }

  async classify(ticket: TicketSelect, attachmentText: string): Promise<ClassifyTicketResponse | null> {
    const userContent = ClassifyTicketPromptUtil.buildUserContent(ticket, attachmentText);

    try {
      const { rawText, latencyMs } = await this.ollamaClassifierClient.classify(CLASSIFY_TICKET_SYSTEM_PROMPT, userContent);
      const result = CLASSIFY_TICKET_RESPONSE_SCHEMA.parse(JSON.parse(rawText));

      this.logger.info({ ticketId: ticket.id, latencyMs }, 'Local fine-tuned classifier produced a valid result');
      return result;
    } catch (err) {
      this.logger.warn({ ticketId: ticket.id, err }, 'Local fine-tuned classifier could not produce a valid result');
      return null;
    }
  }
}
