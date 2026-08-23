import type { UUID } from 'node:crypto';

export class ApproveTicketActionCommand {
  constructor(
    public readonly ticketId: UUID,
    public readonly investigationId: UUID,
    public readonly approvedBy: string,
  ) {}
}
