import { randomUUID } from 'node:crypto';

import type { TicketActionApprovalSelect } from '../../../src/schema/ticket-action-approvals.schema';

export const mockTicketActionApprovalSelect = (
  args: Partial<TicketActionApprovalSelect> = {},
): TicketActionApprovalSelect => ({
  id: randomUUID(),
  ticketInvestigationId: randomUUID(),
  action: 'refund',
  approvedBy: 'approver-client-id',
  approvedAt: new Date(),
  expiresAt: new Date(Date.now() + 15 * 60_000),
  consumedAt: null,
  ...args,
});
