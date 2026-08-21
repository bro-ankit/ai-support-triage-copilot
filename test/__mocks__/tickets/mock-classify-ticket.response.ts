import type { ClassifyTicketResponse } from '../../../src/app/tickets/agents/classify-ticket.agent';

export const mockClassifyTicketResponse = (args: Partial<ClassifyTicketResponse> = {}): ClassifyTicketResponse => ({
  category: 'billing',
  priority: 'high',
  confidence: 0.9,
  ...args,
});
