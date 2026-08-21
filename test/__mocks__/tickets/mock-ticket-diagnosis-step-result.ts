import { randomUUID } from 'node:crypto';

import type { TicketInvestigationInsert } from '../../../src/schema/ticket-investigations.schema';

type TicketDiagnosisStepResult = Omit<TicketInvestigationInsert, 'id' | 'ticketId' | 'createdAt'>;

export const mockTicketDiagnosisStepResult = (
  args: Partial<TicketDiagnosisStepResult> = {},
): TicketDiagnosisStepResult => ({
  retrievedChunkIds: [randomUUID()],
  diagnosis: 'Duplicate webhook delivery caused a double charge.',
  diagnosisConfidence: 0.9,
  proposedAction: 'refund',
  proposedActionReasoning: 'Confirmed duplicate charge for the same order.',
  status: 'completed',
  ...args,
});
