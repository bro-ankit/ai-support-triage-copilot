import { randomUUID } from 'node:crypto';

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TicketResponseDto } from '../dto/ticket-response.dto';
import { TicketRepository } from '../repositories/ticket.repository';
import { CreateTicketCommand } from './create-ticket.command';

@CommandHandler(CreateTicketCommand)
export class CreateTicketCommandHandler implements ICommandHandler<CreateTicketCommand, TicketResponseDto> {
  constructor(
    @InjectPinoLogger(CreateTicketCommandHandler.name) private readonly logger: PinoLogger,
    private readonly ticketRepository: TicketRepository,
  ) {}

  async execute(command: CreateTicketCommand): Promise<TicketResponseDto> {
    const { dto } = command;
    this.logger.info({ subject: dto.subject }, 'Creating ticket');

    const ticket = await this.ticketRepository.insert({
      id: randomUUID(),
      subject: dto.subject,
      description: dto.description,
      priority: dto.priority,
    });

    return plainToInstance(TicketResponseDto, { ...ticket, attachments: [] }, { excludeExtraneousValues: true });
  }
}
