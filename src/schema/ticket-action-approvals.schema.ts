import type { UUID } from 'node:crypto';

import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { ticketInvestigationsTable, type TicketProposedAction } from './ticket-investigations.schema';

export const ticketActionApprovalsTable = pgTable('ticket_action_approvals', {
  id: uuid('id').$type<UUID>().primaryKey(),
  ticketInvestigationId: uuid('ticket_investigation_id')
    .$type<UUID>()
    .notNull()
    .references(() => ticketInvestigationsTable.id, { onDelete: 'cascade' }),
  action: text('action').$type<TicketProposedAction>().notNull(),
  approvedBy: text('approved_by').notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
});

export type TicketActionApprovalSelect = typeof ticketActionApprovalsTable.$inferSelect;
export type TicketActionApprovalInsert = typeof ticketActionApprovalsTable.$inferInsert;

export const TICKET_ACTION_APPROVALS_RELATIONS = relations(ticketActionApprovalsTable, ({ one }) => ({
  investigation: one(ticketInvestigationsTable, {
    fields: [ticketActionApprovalsTable.ticketInvestigationId],
    references: [ticketInvestigationsTable.id],
  }),
}));
