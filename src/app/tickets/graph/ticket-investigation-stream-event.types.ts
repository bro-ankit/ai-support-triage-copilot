import type { InvestigationStage } from '../orchestrator/investigation-progress.types';
import type { TicketInvestigationGraphState } from './ticket-investigation.state';

export type TicketInvestigationStreamEvent =
  | { type: 'progress'; stage: InvestigationStage; message: string }
  | { type: 'result'; investigation: NonNullable<TicketInvestigationGraphState['investigation']> };
