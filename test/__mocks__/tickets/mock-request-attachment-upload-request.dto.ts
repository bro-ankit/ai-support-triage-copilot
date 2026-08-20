import type { RequestAttachmentUploadRequestDto } from '../../../src/app/tickets/dto/request-attachment-upload-request.dto';

export const mockRequestAttachmentUploadRequestDto = (
  args: Partial<RequestAttachmentUploadRequestDto> = {},
): RequestAttachmentUploadRequestDto => ({
  kind: 'screenshot',
  filename: 'error-dialog.png',
  mimeType: 'image/png',
  ...args,
});
