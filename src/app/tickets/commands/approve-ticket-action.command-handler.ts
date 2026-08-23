import { randomUUID } from 'node:crypto';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TicketActionApprovalResponseDto } from '../dto/ticket-action-approval-response.dto';
import { TicketActionApprovalRepository } from '../repositories/ticket-action-approval.repository';
import { TicketInvestigationRepository } from '../repositories/ticket-investigation.repository';
import { TicketRepository } from '../repositories/ticket.repository';
import { TICKETS_ERRORS } from '../tickets.constants';
import { APPROVE_TICKET_ACTION_DEFAULTS } from './approve-ticket-action.constants';
import { ApproveTicketActionCommand } from './approve-ticket-action.command';

@CommandHandler(ApproveTicketActionCommand)
export class ApproveTicketActionCommandHandler
  implements ICommandHandler<ApproveTicketActionCommand, TicketActionApprovalResponseDto> {
  constructor(
    @InjectPinoLogger(ApproveTicketActionCommandHandler.name) private readonly logger: PinoLogger,
    private readonly ticketRepository: TicketRepository,
    private readonly ticketInvestigationRepository: TicketInvestigationRepository,
    private readonly ticketActionApprovalRepository: TicketActionApprovalRepository,
  ) {}

  async execute(command: ApproveTicketActionCommand): Promise<TicketActionApprovalResponseDto> {
    const { ticketId, investigationId, approvedBy } = command;

    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundException(TICKETS_ERRORS.TICKET_NOT_FOUND(ticketId));

    const investigation = await this.ticketInvestigationRepository.findById(investigationId);
    if (!investigation || investigation.ticketId !== ticketId) {
      throw new NotFoundException(TICKETS_ERRORS.INVESTIGATION_NOT_FOUND(investigationId));
    }
    if (!investigation.proposedAction) {
      throw new BadRequestException(TICKETS_ERRORS.NO_PROPOSED_ACTION(investigationId));
    }

    const now = Date.now();
    const approval = await this.ticketActionApprovalRepository.insert({
      id: randomUUID(),
      ticketInvestigationId: investigationId,
      action: investigation.proposedAction,
      approvedBy,
      expiresAt: new Date(now + APPROVE_TICKET_ACTION_DEFAULTS.APPROVAL_TTL_MINUTES * 60_000),
    });

    this.logger.info({ investigationId, approvedBy, action: approval.action }, 'Ticket action approved');

    return plainToInstance(TicketActionApprovalResponseDto, approval, { excludeExtraneousValues: true });
  }
}
