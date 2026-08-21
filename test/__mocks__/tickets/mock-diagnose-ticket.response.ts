import type { DiagnoseTicketResponse } from '../../../src/app/tickets/agents/diagnose-ticket.agent';

export const mockDiagnoseTicketResponse = (args: Partial<DiagnoseTicketResponse> = {}): DiagnoseTicketResponse => ({
  diagnosis: 'Duplicate webhook delivery caused a double charge.',
  confidence: 0.9,
  ...args,
});
