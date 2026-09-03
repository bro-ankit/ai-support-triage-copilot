import type { ITicketInvestigationNode } from './ticket-investigation-node.interface';

export const TICKET_INVESTIGATION_NODES = Symbol('TICKET_INVESTIGATION_NODES');

export type TicketInvestigationNodes = {
  loadContext: ITicketInvestigationNode;
  classify: ITicketInvestigationNode;
  recall: ITicketInvestigationNode;
  retrieve: ITicketInvestigationNode;
  diagnose: ITicketInvestigationNode;
  propose: ITicketInvestigationNode;
  persist: ITicketInvestigationNode;
};
