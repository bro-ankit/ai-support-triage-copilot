import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { TICKET_COMMAND_HANDLERS } from './commands';
import { TICKET_QUERY_HANDLERS } from './queries';
import { TicketAttachmentRepository } from './repositories/ticket-attachment.repository';
import { TicketRepository } from './repositories/ticket.repository';
import { TicketsController } from './tickets.controller';

@Module({
  imports: [CqrsModule],
  providers: [TicketRepository, TicketAttachmentRepository, ...TICKET_COMMAND_HANDLERS, ...TICKET_QUERY_HANDLERS],
  controllers: [TicketsController],
})
export class TicketsModule {}
