import { randomUUID } from 'node:crypto';

import type { TicketInvestigationResponseDto } from '../../../src/app/tickets/dto/ticket-investigation-response.dto';

export const mockTicketInvestigationResponseDto = (
  args: Partial<TicketInvestigationResponseDto> = {},
): TicketInvestigationResponseDto => ({
  id: randomUUID(),
  retrievedChunkIds: [randomUUID()],
  citedChunkIds: [randomUUID()],
  diagnosis: 'Duplicate webhook delivery caused a double charge.',
  diagnosisConfidence: 0.9,
  proposedAction: 'refund',
  proposedActionReasoning: 'Confirmed duplicate charge for the same order.',
  status: 'completed',
  createdAt: new Date(),
  ...args,
});
