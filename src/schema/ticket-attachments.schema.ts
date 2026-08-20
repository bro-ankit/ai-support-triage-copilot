import type { UUID } from 'node:crypto';

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { ticketsTable } from './tickets.schema';

export const TICKET_ATTACHMENT_KINDS = ['screenshot', 'voice_note'] as const;
export type TicketAttachmentKind = (typeof TICKET_ATTACHMENT_KINDS)[number];

export const TICKET_ATTACHMENT_PROCESSING_STATUSES = [
  'pending_upload',
  'pending',
  'processing',
  'completed',
  'failed',
] as const;
export type TicketAttachmentProcessingStatus = (typeof TICKET_ATTACHMENT_PROCESSING_STATUSES)[number];

export const ticketAttachmentsTable = pgTable('ticket_attachments', {
  id: uuid('id').$type<UUID>().primaryKey(),
  ticketId: uuid('ticket_id')
    .$type<UUID>()
    .notNull()
    .references(() => ticketsTable.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<TicketAttachmentKind>().notNull(),
  objectKey: text('object_key').notNull(),
  mimeType: text('mime_type').notNull(),
  extractedText: text('extracted_text'),
  processingStatus: text('processing_status').$type<TicketAttachmentProcessingStatus>().notNull().default('pending_upload'),
  processingError: text('processing_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TicketAttachmentSelect = typeof ticketAttachmentsTable.$inferSelect;
export type TicketAttachmentInsert = typeof ticketAttachmentsTable.$inferInsert;
