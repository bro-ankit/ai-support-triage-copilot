import type { CreateTicketRequestDto } from '../../../src/app/tickets/dto/create-ticket-request.dto';

export const mockCreateTicketRequestDto = (
  args: Partial<CreateTicketRequestDto> = {},
): CreateTicketRequestDto => ({
  subject: '📱 Checkout button does nothing on mobile',
  description: 'Tapping the pay button on mobile Safari does not submit the order.',
  priority: 'medium',
  ...args,
});
