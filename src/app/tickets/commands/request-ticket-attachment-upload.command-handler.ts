import { randomUUID } from 'node:crypto';

import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { RequestAttachmentUploadResponseDto } from '../dto/request-attachment-upload-response.dto';
import { STORAGE_CLIENT } from '../../../storage/storage.constants';
import type { IStorageClient } from '../../../storage/storage.interface';
import { TicketAttachmentKeyUtil } from '../helpers/ticket-attachment-key.util';
import { TicketAttachmentRepository } from '../repositories/ticket-attachment.repository';
import { TicketRepository } from '../repositories/ticket.repository';
import { TICKETS_ERRORS } from '../tickets.constants';
import { RequestTicketAttachmentUploadCommand } from './request-ticket-attachment-upload.command';
import { MAX_ATTACHMENT_SIZE_BYTES } from './request-ticket-attachment-upload.constants';

@CommandHandler(RequestTicketAttachmentUploadCommand)
export class RequestTicketAttachmentUploadCommandHandler
  implements ICommandHandler<RequestTicketAttachmentUploadCommand, RequestAttachmentUploadResponseDto> {
  constructor(
    @InjectPinoLogger(RequestTicketAttachmentUploadCommandHandler.name) private readonly logger: PinoLogger,
    @Inject(STORAGE_CLIENT) private readonly storageClient: IStorageClient,
    private readonly ticketRepository: TicketRepository,
    private readonly ticketAttachmentRepository: TicketAttachmentRepository,
  ) { }

  async execute(command: RequestTicketAttachmentUploadCommand): Promise<RequestAttachmentUploadResponseDto> {
    const { ticketId, dto } = command;

    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundException(TICKETS_ERRORS.TICKET_NOT_FOUND(ticketId));

    const objectKey = TicketAttachmentKeyUtil.build(ticketId, dto.filename);
    const maxSizeBytes = MAX_ATTACHMENT_SIZE_BYTES[dto.kind];

    const { url: uploadUrl, fields: uploadFields } = await this.storageClient.getPresignedUploadUrl(
      objectKey,
      dto.mimeType,
      maxSizeBytes,
    );

    const attachment = await this.ticketAttachmentRepository.insert({
      id: randomUUID(),
      ticketId,
      kind: dto.kind,
      objectKey,
      mimeType: dto.mimeType,
      processingStatus: 'pending_upload',
    });

    this.logger.info({ ticketId, attachmentId: attachment.id, objectKey }, 'Presigned attachment upload URL issued');

    return plainToInstance(
      RequestAttachmentUploadResponseDto,
      { attachmentId: attachment.id, uploadUrl, uploadFields, objectKey },
      { excludeExtraneousValues: true },
    );
  }
}
