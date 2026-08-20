import { randomUUID } from 'node:crypto';

import type { TicketSelect } from '../../../src/schema/tickets.schema';

export const mockTicketSelect = (args: Partial<TicketSelect> = {}): TicketSelect => ({
  id: randomUUID(),
  subject: '📱 Checkout button does nothing on mobile',
  description: 'Tapping the pay button on mobile Safari does not submit the order.',
  status: 'open',
  priority: 'medium',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...args,
});
