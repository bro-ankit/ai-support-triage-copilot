import type { UUID } from 'node:crypto';

import type { RequestAttachmentUploadRequestDto } from '../dto/request-attachment-upload-request.dto';

export class RequestTicketAttachmentUploadCommand {
  constructor(
    public readonly ticketId: UUID,
    public readonly dto: RequestAttachmentUploadRequestDto,
  ) {}
}
