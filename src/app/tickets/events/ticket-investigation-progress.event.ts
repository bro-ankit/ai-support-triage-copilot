import type { UUID } from 'node:crypto';

import type { InvestigationStage } from '../orchestrator/investigation-progress.types';

export class TicketInvestigationProgressEvent {
  constructor(
    public readonly ticketId: UUID,
    public readonly stage: InvestigationStage,
    public readonly message: string,
  ) {}
}
