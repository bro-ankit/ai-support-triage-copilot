import { randomUUID } from 'node:crypto';

import type { TicketDiagnosisStepResult } from '../../../src/app/tickets/orchestrator/steps/ticket-diagnosis-step.service';

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
