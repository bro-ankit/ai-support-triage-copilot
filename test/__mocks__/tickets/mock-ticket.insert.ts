import { randomUUID } from 'node:crypto';

import type { TicketInsert } from '../../../src/schema/tickets.schema';

export const mockTicketInsert = (args: Partial<TicketInsert> = {}): TicketInsert => ({
  id: randomUUID(),
  subject: '📱 Checkout button does nothing on mobile',
  description: 'Tapping the pay button on mobile Safari does not submit the order.',
  priority: 'medium',
  ...args,
});
