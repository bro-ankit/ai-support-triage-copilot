import type { UUID } from 'node:crypto';

import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { EMBEDDING_DIMENSIONS } from '../ai/gemini/gemini.constants';
import { kbArticlesTable } from './kb-articles.schema';
import { tsvector } from './tsvector.type';
import { VectorTypeUtil } from './vector.util';

export const kbChunksTable = pgTable('kb_chunks', {
  id: uuid('id').$type<UUID>().primaryKey(),
  articleId: uuid('article_id')
    .$type<UUID>()
    .notNull()
    .references(() => kbArticlesTable.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').notNull(),
  embedding: VectorTypeUtil.createVectorType(EMBEDDING_DIMENSIONS)('embedding'),
  contentTsv: tsvector('content_tsv'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type KbChunkSelect = typeof kbChunksTable.$inferSelect;
export type KbChunkInsert = typeof kbChunksTable.$inferInsert;
