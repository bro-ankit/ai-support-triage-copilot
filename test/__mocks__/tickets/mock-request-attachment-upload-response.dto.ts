import { randomUUID } from 'node:crypto';

import type { RequestAttachmentUploadResponseDto } from '../../../src/app/tickets/dto/request-attachment-upload-response.dto';

export const mockRequestAttachmentUploadResponseDto = (
  args: Partial<RequestAttachmentUploadResponseDto> = {},
): RequestAttachmentUploadResponseDto => ({
  attachmentId: randomUUID(),
  uploadUrl: 'https://s3.example.com/support-triage-attachments',
  uploadFields: { key: 'field-value' },
  objectKey: `tickets/${randomUUID()}/${randomUUID()}-screenshot.png`,
  ...args,
});
