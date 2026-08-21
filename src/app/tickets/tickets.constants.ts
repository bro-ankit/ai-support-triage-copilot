export const TICKETS_ERRORS = {
  TICKET_NOT_FOUND: (id: string) => `Ticket ${id} not found`,
  ATTACHMENT_NOT_FOUND: (id: string) => `Ticket attachment ${id} not found`,
  INVESTIGATION_ABORTED: 'Investigation aborted: client disconnected',
} as const;
