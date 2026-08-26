import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { InjectionHeuristicUtil } from '../../../../ai/injection-heuristic.util';
import type { TicketSelect } from '../../../../schema/tickets.schema';
import { TicketClassifierAgent } from '../../classification/ticket-classifier.agent';
import { TicketClassificationRepository } from '../../repositories/ticket-classification.repository';

@Injectable()
export class TicketClassificationStepService {
  constructor(
    @InjectPinoLogger(TicketClassificationStepService.name) private readonly logger: PinoLogger,
    private readonly ticketClassifierAgent: TicketClassifierAgent,
    private readonly ticketClassificationRepository: TicketClassificationRepository,
  ) { }

  async run(ticket: TicketSelect, attachmentText: string): Promise<void> {
    this.logger.debug({ ticketId: ticket.id }, 'Running ticket classification step');

    if (ticket.description && InjectionHeuristicUtil.looksLikeInjectionAttempt(ticket.description)) {
      this.logger.warn({ ticketId: ticket.id }, 'Possible prompt injection attempt detected in ticket description');
    }

    try {
      const classification = await this.ticketClassifierAgent.classify(ticket, attachmentText);
      await this.ticketClassificationRepository.insert({
        id: randomUUID(),
        ticketId: ticket.id,
        category: classification.category,
        priority: classification.priority,
        confidence: classification.confidence,
      });
      this.logger.info(
        { ticketId: ticket.id, category: classification.category, priority: classification.priority },
        'Ticket classification step complete',
      );
    } catch (err) {
      this.logger.warn({ ticketId: ticket.id, err }, 'Ticket classification failed, proceeding without it');
    }
  }
}
