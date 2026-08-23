export const TICKETS_ERRORS = {
  TICKET_NOT_FOUND: (id: string) => `Ticket ${id} not found`,
  ATTACHMENT_NOT_FOUND: (id: string) => `Ticket attachment ${id} not found`,
  INVESTIGATION_ABORTED: 'Investigation aborted: client disconnected',
  INVESTIGATION_NOT_FOUND: (id: string) => `Ticket investigation ${id} not found`,
  NO_PROPOSED_ACTION: (id: string) => `Ticket investigation ${id} has no proposed action to approve`,
  NO_APPROVAL: (id: string) => `Ticket investigation ${id} has no approval on record`,
  APPROVAL_NOT_CONSUMABLE: (id: string) =>
    `Approval ${id} could not be executed: it is already consumed or has expired`,
} as const;
