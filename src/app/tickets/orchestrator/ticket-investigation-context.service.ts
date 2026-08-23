import type { UUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { TicketSelect } from '../../../schema/tickets.schema';
import { TicketRepository } from '../repositories/ticket.repository';
import { TICKETS_ERRORS } from '../tickets.constants';

export type TicketInvestigationContext = {
  ticket: TicketSelect;
  attachmentText: string;
};

@Injectable()
export class TicketInvestigationContextService {
  constructor(
    @InjectPinoLogger(TicketInvestigationContextService.name) private readonly logger: PinoLogger,
    private readonly ticketRepository: TicketRepository,
  ) { }

  async load(ticketId: UUID): Promise<TicketInvestigationContext> {
    this.logger.debug({ ticketId }, 'Loading ticket investigation context');

    const result = await this.ticketRepository.findById(ticketId, { attachments: true } as const);
    if (!result) throw new NotFoundException(TICKETS_ERRORS.TICKET_NOT_FOUND(ticketId));

    const { attachments, ...ticket } = result;

    const attachmentText = attachments
      .filter((a) => a.processingStatus === 'completed' && a.extractedText)
      .map((a) => a.extractedText)
      .join('\n');

    this.logger.debug({ ticketId, attachmentCount: attachments.length }, 'Ticket investigation context loaded');
    return { ticket, attachmentText };
  }
}
