import type { UUID } from 'node:crypto';

import { relations } from 'drizzle-orm';
import { doublePrecision, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { ticketActionApprovalsTable } from './ticket-action-approvals.schema';
import { ticketsTable } from './tickets.schema';

export const TICKET_PROPOSED_ACTIONS = ['refund', 'account_credit', 'escalation', 'reply_only'] as const;
export type TicketProposedAction = (typeof TICKET_PROPOSED_ACTIONS)[number];

export const TICKET_INVESTIGATION_STATUSES = [
  'completed',
  'needs_review',
  'failed',
  'action_executed',
] as const;
export type TicketInvestigationStatus = (typeof TICKET_INVESTIGATION_STATUSES)[number];

export const ticketInvestigationsTable = pgTable('ticket_investigations', {
  id: uuid('id').$type<UUID>().primaryKey(),
  ticketId: uuid('ticket_id')
    .$type<UUID>()
    .notNull()
    .references(() => ticketsTable.id, { onDelete: 'cascade' }),
  retrievedChunkIds: jsonb('retrieved_chunk_ids').$type<UUID[]>().notNull(),
  diagnosis: text('diagnosis').notNull(),
  diagnosisConfidence: doublePrecision('diagnosis_confidence').notNull(),
  proposedAction: text('proposed_action').$type<TicketProposedAction>(),
  proposedActionReasoning: text('proposed_action_reasoning'),
  status: text('status').$type<TicketInvestigationStatus>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TicketInvestigationSelect = typeof ticketInvestigationsTable.$inferSelect;
export type TicketInvestigationInsert = typeof ticketInvestigationsTable.$inferInsert;

export const TICKET_INVESTIGATIONS_RELATIONS = relations(ticketInvestigationsTable, ({ one, many }) => ({
  ticket: one(ticketsTable, { fields: [ticketInvestigationsTable.ticketId], references: [ticketsTable.id] }),
  approvals: many(ticketActionApprovalsTable),
}));
