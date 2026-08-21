import { randomUUID } from 'node:crypto';

import type { TicketAttachmentResponseDto } from '../../../src/app/tickets/dto/ticket-response.dto';

export const mockTicketAttachmentResponseDto = (
  args: Partial<TicketAttachmentResponseDto> = {},
): TicketAttachmentResponseDto => ({
  id: randomUUID(),
  kind: 'screenshot',
  mimeType: 'image/png',
  extractedText: 'Error 500',
  processingStatus: 'completed',
  processingError: null,
  ...args,
});
