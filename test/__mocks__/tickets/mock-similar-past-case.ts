import { randomUUID } from 'node:crypto';

import type { SimilarPastTicketCase } from '../../../src/app/tickets/memory/ticket-episodic-memory.types';

export const mockSimilarPastCase = (args: Partial<SimilarPastTicketCase> = {}): SimilarPastTicketCase => ({
  ticketId: randomUUID(),
  subject: 'Charged twice for order #1234',
  description: 'Please refund the duplicate charge.',
  diagnosis: 'Duplicate webhook delivery caused a double charge.',
  proposedAction: 'refund',
  distance: 0.05,
  ...args,
});
