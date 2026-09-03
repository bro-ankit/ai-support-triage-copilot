import { randomUUID } from 'node:crypto';

import type { TicketInvestigationSelect } from '../../../src/schema/ticket-investigations.schema';
import { MOCK_TENANT_ID } from '../mock-tenant-id';

export const mockTicketInvestigationSelect = (
  args: Partial<TicketInvestigationSelect> = {},
): TicketInvestigationSelect => ({
  id: randomUUID(),
  tenantId: MOCK_TENANT_ID,
  ticketId: randomUUID(),
  retrievedChunkIds: [randomUUID()],
  diagnosis: 'Duplicate webhook delivery caused a double charge.',
  diagnosisConfidence: 0.9,
  proposedAction: 'refund',
  proposedActionReasoning: 'Confirmed duplicate charge for the same order.',
  status: 'completed',
  createdAt: new Date(),
  ...args,
});
