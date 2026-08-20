import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TicketResponseDto } from '../dto/ticket-response.dto';
import { TicketAttachmentRepository } from '../repositories/ticket-attachment.repository';
import { TicketRepository } from '../repositories/ticket.repository';
import { TICKETS_ERRORS } from '../tickets.constants';
import { GetTicketQuery } from './get-ticket.query';

@QueryHandler(GetTicketQuery)
export class GetTicketQueryHandler implements IQueryHandler<GetTicketQuery, TicketResponseDto> {
  constructor(
    @InjectPinoLogger(GetTicketQueryHandler.name) private readonly logger: PinoLogger,
    private readonly ticketRepository: TicketRepository,
    private readonly ticketAttachmentRepository: TicketAttachmentRepository,
  ) {}

  async execute(query: GetTicketQuery): Promise<TicketResponseDto> {
    this.logger.debug({ ticketId: query.ticketId }, 'Fetching ticket with attachments');

    const ticket = await this.ticketRepository.findById(query.ticketId);
    if (!ticket) throw new NotFoundException(TICKETS_ERRORS.TICKET_NOT_FOUND(query.ticketId));

    const attachments = await this.ticketAttachmentRepository.findByTicketId(query.ticketId);

    return plainToInstance(TicketResponseDto, { ...ticket, attachments }, { excludeExtraneousValues: true });
  }
}
