import type { UUID } from 'node:crypto';

import { relations } from 'drizzle-orm';
import { doublePrecision, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { ticketsTable, type TicketPriority } from './tickets.schema';

export const TICKET_CATEGORIES = ['billing', 'account', 'bug', 'other'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const ticketClassificationsTable = pgTable('ticket_classifications', {
  id: uuid('id').$type<UUID>().primaryKey(),
  ticketId: uuid('ticket_id')
    .$type<UUID>()
    .notNull()
    .references(() => ticketsTable.id, { onDelete: 'cascade' }),
  category: text('category').$type<TicketCategory>().notNull(),
  priority: text('priority').$type<TicketPriority>().notNull(),
  confidence: doublePrecision('confidence').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TicketClassificationSelect = typeof ticketClassificationsTable.$inferSelect;
export type TicketClassificationInsert = typeof ticketClassificationsTable.$inferInsert;

export const TICKET_CLASSIFICATIONS_RELATIONS = relations(ticketClassificationsTable, ({ one }) => ({
  ticket: one(ticketsTable, { fields: [ticketClassificationsTable.ticketId], references: [ticketsTable.id] }),
}));
