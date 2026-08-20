import type { UUID } from 'node:crypto';

export class CompleteTicketAttachmentUploadCommand {
  constructor(
    public readonly ticketId: UUID,
    public readonly attachmentId: UUID,
  ) {}
}
