import type { UUID } from 'node:crypto';

export class ExecuteTicketActionCommand {
  constructor(
    public readonly ticketId: UUID,
    public readonly investigationId: UUID,
  ) {}
}
