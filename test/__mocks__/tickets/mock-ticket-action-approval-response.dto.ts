import { randomUUID } from 'node:crypto';

import type { TicketActionApprovalResponseDto } from '../../../src/app/tickets/dto/ticket-action-approval-response.dto';

export const mockTicketActionApprovalResponseDto = (
  args: Partial<TicketActionApprovalResponseDto> = {},
): TicketActionApprovalResponseDto => ({
  id: randomUUID(),
  ticketInvestigationId: randomUUID(),
  action: 'refund',
  approvedBy: 'approver-client-id',
  approvedAt: new Date(),
  expiresAt: new Date(Date.now() + 15 * 60_000),
  ...args,
});
