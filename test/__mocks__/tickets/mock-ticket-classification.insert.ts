import { randomUUID } from 'node:crypto';

import type { TicketClassificationInsert } from '../../../src/schema/ticket-classifications.schema';

export const mockTicketClassificationInsert = (
  args: Partial<TicketClassificationInsert> = {},
): TicketClassificationInsert => ({
  id: randomUUID(),
  ticketId: randomUUID(),
  category: 'billing',
  priority: 'high',
  confidence: 0.9,
  ...args,
});
