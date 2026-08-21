import { randomUUID } from 'node:crypto';

import type { TicketResponseDto } from '../../../src/app/tickets/dto/ticket-response.dto';

export const mockTicketResponseDto = (args: Partial<TicketResponseDto> = {}): TicketResponseDto => ({
  id: randomUUID(),
  subject: '📱 Checkout button does nothing on mobile',
  description: 'Tapping the pay button on mobile Safari does not submit the order.',
  status: 'open',
  priority: 'medium',
  attachments: [],
  createdAt: new Date(),
  ...args,
});
