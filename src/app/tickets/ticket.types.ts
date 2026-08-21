import type { TicketAttachmentSelect } from '../../schema/ticket-attachments.schema';
import type { TicketSelect } from '../../schema/tickets.schema';

type TicketRelationsMap = {
  attachments: TicketAttachmentSelect[];
};

export type DynamicTicket<R> = TicketSelect & {
  [K in keyof R & keyof TicketRelationsMap as R[K] extends true ? K : never]: TicketRelationsMap[K];
};
