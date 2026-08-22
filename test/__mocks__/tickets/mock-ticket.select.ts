import { randomUUID } from 'node:crypto';

import type { TicketSelect } from '../../../src/schema/tickets.schema';
import { MOCK_TENANT_ID } from '../mock-tenant-id';

export const mockTicketSelect = (args: Partial<TicketSelect> = {}): TicketSelect => ({
  id: randomUUID(),
  tenantId: MOCK_TENANT_ID,
  subject: '📱 Checkout button does nothing on mobile',
  description: 'Tapping the pay button on mobile Safari does not submit the order.',
  status: 'open',
  priority: 'medium',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...args,
});
