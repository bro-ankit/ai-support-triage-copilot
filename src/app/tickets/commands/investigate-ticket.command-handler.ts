import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TicketInvestigationResponseDto } from '../dto/ticket-investigation-response.dto';
import { TicketInvestigationOrchestratorService } from '../orchestrator/ticket-investigation-orchestrator.service';
import { InvestigateTicketCommand } from './investigate-ticket.command';

@CommandHandler(InvestigateTicketCommand)
export class InvestigateTicketCommandHandler
  implements ICommandHandler<InvestigateTicketCommand, TicketInvestigationResponseDto>
{
  constructor(
    @InjectPinoLogger(InvestigateTicketCommandHandler.name) private readonly logger: PinoLogger,
    private readonly orchestrator: TicketInvestigationOrchestratorService,
  ) {}

  async execute(command: InvestigateTicketCommand): Promise<TicketInvestigationResponseDto> {
    this.logger.debug({ ticketId: command.ticketId }, 'Executing investigate ticket command');

    const investigation = await this.orchestrator.investigate(command.ticketId, command.abortSignal);

    return plainToInstance(TicketInvestigationResponseDto, investigation, { excludeExtraneousValues: true });
  }
}
