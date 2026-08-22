import { randomUUID } from 'node:crypto';

import type { TicketInsert } from '../../../src/schema/tickets.schema';
import { MOCK_TENANT_ID } from '../mock-tenant-id';

export const mockTicketInsert = (args: Partial<TicketInsert> = {}): TicketInsert => ({
  id: randomUUID(),
  tenantId: MOCK_TENANT_ID,
  subject: '📱 Checkout button does nothing on mobile',
  description: 'Tapping the pay button on mobile Safari does not submit the order.',
  priority: 'medium',
  ...args,
});
