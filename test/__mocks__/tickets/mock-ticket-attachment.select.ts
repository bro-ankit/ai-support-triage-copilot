import { randomUUID } from 'node:crypto';

import type { TicketAttachmentSelect } from '../../../src/schema/ticket-attachments.schema';

export const mockTicketAttachmentSelect = (
  args: Partial<TicketAttachmentSelect> = {},
): TicketAttachmentSelect => ({
  id: randomUUID(),
  ticketId: randomUUID(),
  kind: 'screenshot',
  objectKey: `tickets/${randomUUID()}/${randomUUID()}-screenshot.png`,
  mimeType: 'image/png',
  extractedText: null,
  processingStatus: 'pending_upload',
  processingError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...args,
});
