import type { ProposeTicketActionResponse } from '../../../src/app/tickets/agents/propose-ticket-action.agent';

export const mockProposeTicketActionResponse = (
  args: Partial<ProposeTicketActionResponse> = {},
): ProposeTicketActionResponse => ({
  action: 'refund',
  reasoning: 'Confirmed duplicate charge for the same order.',
  ...args,
});
