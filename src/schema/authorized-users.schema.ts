import type { UUID } from 'node:crypto';

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const authorizedUsersTable = pgTable('authorized_users', {
  id: uuid('id').$type<UUID>().primaryKey(),
  sub: text('sub').notNull().unique(),
  tenantId: uuid('tenant_id').$type<UUID>().notNull(),
  scopes: text('scopes').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AuthorizedUserSelect = typeof authorizedUsersTable.$inferSelect;
export type AuthorizedUserInsert = typeof authorizedUsersTable.$inferInsert;
