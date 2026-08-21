import type { UUID } from 'node:crypto';

export class InvestigateTicketCommand {
  constructor(
    public readonly ticketId: UUID,
    public readonly abortSignal?: AbortSignal,
  ) {}
}
