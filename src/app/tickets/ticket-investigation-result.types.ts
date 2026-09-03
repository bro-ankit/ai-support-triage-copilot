import type { TicketInvestigationInsert } from '../../schema/ticket-investigations.schema';

export type TicketInvestigationResult = Omit<TicketInvestigationInsert, 'id' | 'ticketId' | 'tenantId' | 'createdAt'>;
