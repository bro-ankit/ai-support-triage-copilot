import type { CreateTicketRequestDto } from '../dto/create-ticket-request.dto';

export class CreateTicketCommand {
  constructor(public readonly dto: CreateTicketRequestDto) {}
}
