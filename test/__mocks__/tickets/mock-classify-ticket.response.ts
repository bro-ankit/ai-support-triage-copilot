import type { ClassifyTicketResponse } from '../../../src/app/tickets/classification/ticket-classification.contract';

export const mockClassifyTicketResponse = (args: Partial<ClassifyTicketResponse> = {}): ClassifyTicketResponse => ({
  category: 'billing',
  priority: 'high',
  confidence: 0.9,
  ...args,
});
