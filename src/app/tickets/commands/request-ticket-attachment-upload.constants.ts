import type { TicketAttachmentKind } from '../../../schema/ticket-attachments.schema';

export const MAX_ATTACHMENT_SIZE_BYTES: Record<TicketAttachmentKind, number> = {
  screenshot: 10 * 1024 * 1024,
  voice_note: 25 * 1024 * 1024,
};
