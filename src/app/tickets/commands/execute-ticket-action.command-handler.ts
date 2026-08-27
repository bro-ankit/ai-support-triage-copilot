import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DrizzleTransactionService } from '../../../database/drizzle-transaction.service';
import { Traced } from '../../../tracing/traced.decorator';
import { TicketInvestigationResponseDto } from '../dto/ticket-investigation-response.dto';
import { TicketActionApprovalRepository } from '../repositories/ticket-action-approval.repository';
import { TicketInvestigationRepository } from '../repositories/ticket-investigation.repository';
import { TicketRepository } from '../repositories/ticket.repository';
import { TICKETS_ERRORS } from '../tickets.constants';
import { ExecuteTicketActionCommand } from './execute-ticket-action.command';

@CommandHandler(ExecuteTicketActionCommand)
export class ExecuteTicketActionCommandHandler
  implements ICommandHandler<ExecuteTicketActionCommand, TicketInvestigationResponseDto> {
  constructor(
    @InjectPinoLogger(ExecuteTicketActionCommandHandler.name) private readonly logger: PinoLogger,
    private readonly dbTransactionService: DrizzleTransactionService,
    private readonly ticketRepository: TicketRepository,
    private readonly ticketInvestigationRepository: TicketInvestigationRepository,
    private readonly ticketActionApprovalRepository: TicketActionApprovalRepository,
  ) { }

  @Traced<[ExecuteTicketActionCommand], TicketInvestigationResponseDto>(
    'gate_execute',
    (command) => ({ 'ticket.id': command.ticketId, 'investigation.id': command.investigationId }),
    (result) => ({ 'investigation.status': result.status }),
  )
  async execute(command: ExecuteTicketActionCommand): Promise<TicketInvestigationResponseDto> {
    const { ticketId, investigationId } = command;

    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundException(TICKETS_ERRORS.TICKET_NOT_FOUND(ticketId));

    const investigation = await this.ticketInvestigationRepository.findById(investigationId);
    if (!investigation || investigation.ticketId !== ticketId) {
      throw new NotFoundException(TICKETS_ERRORS.INVESTIGATION_NOT_FOUND(investigationId));
    }

    const approval = await this.ticketActionApprovalRepository.findLatestByInvestigationId(investigationId);
    if (!approval) throw new ConflictException(TICKETS_ERRORS.NO_APPROVAL(investigationId));

    const updated = await this.dbTransactionService.execute(async () => {
      const consumed = await this.ticketActionApprovalRepository.consumeIfActive(approval.id);
      if (!consumed) throw new ConflictException(TICKETS_ERRORS.APPROVAL_NOT_CONSUMABLE(approval.id));

      return this.ticketInvestigationRepository.updateStatus(investigationId, 'action_executed');
    });

    this.logger.info({ investigationId, approvalId: approval.id, action: approval.action }, 'Ticket action executed');

    return plainToInstance(TicketInvestigationResponseDto, updated, { excludeExtraneousValues: true });
  }
}
