import type { UUID } from 'node:crypto';

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const TICKET_STATUSES = ['open', 'investigating', 'resolved'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const ticketsTable = pgTable('tickets', {
  id: uuid('id').$type<UUID>().primaryKey(),
  subject: text('subject').notNull(),
  description: text('description'),
  status: text('status').$type<TicketStatus>().notNull().default('open'),
  priority: text('priority').$type<TicketPriority>().notNull().default('medium'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TicketSelect = typeof ticketsTable.$inferSelect;
export type TicketInsert = typeof ticketsTable.$inferInsert;
