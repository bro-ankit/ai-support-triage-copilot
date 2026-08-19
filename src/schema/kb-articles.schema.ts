import type { UUID } from 'node:crypto';

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const KB_SOURCE_TYPES = ['kb_article', 'postmortem'] as const;
export type KbSourceType = (typeof KB_SOURCE_TYPES)[number];

export const kbArticlesTable = pgTable('kb_articles', {
  id: uuid('id').$type<UUID>().primaryKey(),
  title: text('title').notNull(),
  sourceType: text('source_type').$type<KbSourceType>().notNull(),
  rawContent: text('raw_content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type KbArticleSelect = typeof kbArticlesTable.$inferSelect;
export type KbArticleInsert = typeof kbArticlesTable.$inferInsert;
