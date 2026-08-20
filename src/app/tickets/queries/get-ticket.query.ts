import type { UUID } from 'node:crypto';

export class GetTicketQuery {
  constructor(public readonly ticketId: UUID) {}
}
