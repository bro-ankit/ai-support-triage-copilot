import { randomUUID } from 'node:crypto';

import type { TicketInvestigationResult } from '../../../src/app/tickets/ticket-investigation-result.types';

export const mockTicketInvestigationResult = (
  args: Partial<TicketInvestigationResult> = {},
): TicketInvestigationResult => ({
  retrievedChunkIds: [randomUUID()],
  diagnosis: 'Duplicate webhook delivery caused a double charge.',
  diagnosisConfidence: 0.9,
  proposedAction: 'refund',
  proposedActionReasoning: 'Confirmed duplicate charge for the same order.',
  status: 'completed',
  ...args,
});
