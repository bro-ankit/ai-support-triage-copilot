import type { UUID } from 'node:crypto';

import type { TicketProposedAction } from '../../../schema/ticket-investigations.schema';

export type SimilarPastTicketCase = {
  ticketId: UUID;
  subject: string;
  description: string | null;
  diagnosis: string;
  proposedAction: TicketProposedAction | null;
  distance: number;
};
