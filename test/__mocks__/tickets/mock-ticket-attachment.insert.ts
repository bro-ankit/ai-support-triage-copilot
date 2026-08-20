import { randomUUID } from 'node:crypto';

import type { TicketAttachmentInsert } from '../../../src/schema/ticket-attachments.schema';

export const mockTicketAttachmentInsert = (
  args: Partial<TicketAttachmentInsert> = {},
): TicketAttachmentInsert => ({
  id: randomUUID(),
  ticketId: randomUUID(),
  kind: 'screenshot',
  objectKey: `tickets/${randomUUID()}/${randomUUID()}-screenshot.png`,
  mimeType: 'image/png',
  processingStatus: 'pending_upload',
  ...args,
});
