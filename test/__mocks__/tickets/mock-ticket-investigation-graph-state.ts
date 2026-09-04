import { randomUUID } from 'crypto';

import { TicketInvestigationGraphState } from '../../../src/app/tickets/graph/ticket-investigation.state';
import { mockDiagnoseTicketResponse } from './mock-diagnose-ticket.response';
import { mockTicketSelect } from './mock-ticket.select';
import { mockTicketInvestigationSelect } from './mock-ticket-investigation.select';
import { mockTicketInvestigationResult } from './mock-ticket-investigation-result';

export const mockTicketInvestigationGraphState = (
  overrides: Partial<TicketInvestigationGraphState> = {},
): TicketInvestigationGraphState => ({
  ticketId: randomUUID(),
  ticket: mockTicketSelect(),
  diagnosis: mockDiagnoseTicketResponse(),
  retrievedChunkIds: [],
  citedChunkIds: [],
  attachmentText: '',
  searchQuery: '',
  pastCases: [],
  kbChunks: [],
  earlyResult: mockTicketInvestigationResult(),
  investigation: mockTicketInvestigationSelect(),
  ...overrides,
});
