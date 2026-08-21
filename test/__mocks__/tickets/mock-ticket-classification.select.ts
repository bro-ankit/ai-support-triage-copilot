import { randomUUID } from 'node:crypto';

import type { TicketClassificationSelect } from '../../../src/schema/ticket-classifications.schema';

export const mockTicketClassificationSelect = (
  args: Partial<TicketClassificationSelect> = {},
): TicketClassificationSelect => ({
  id: randomUUID(),
  ticketId: randomUUID(),
  category: 'billing',
  priority: 'high',
  confidence: 0.9,
  createdAt: new Date(),
  ...args,
});
