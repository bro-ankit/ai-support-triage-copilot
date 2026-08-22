import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { IAiClient } from '../../../ai/ai.interface';
import { TrackAiUsage } from '../../../metrics/track-ai-usage.decorator';
import type { TicketAttachmentSelect } from '../../../schema/ticket-attachments.schema';
import { CompleteTicketAttachmentUploadCommand } from './complete-ticket-attachment-upload.command';
import { TicketAttachmentResponseDto } from '../dto/ticket-response.dto';
import { STORAGE_CLIENT } from '../../../storage/storage.constants';
import type { IStorageClient } from '../../../storage/storage.interface';
import { TicketAttachmentRepository } from '../repositories/ticket-attachment.repository';
import { TicketRepository } from '../repositories/ticket.repository';
import { TICKETS_ERRORS } from '../tickets.constants';

@CommandHandler(CompleteTicketAttachmentUploadCommand)
export class CompleteTicketAttachmentUploadCommandHandler
  implements ICommandHandler<CompleteTicketAttachmentUploadCommand, TicketAttachmentResponseDto> {
  constructor(
    @InjectPinoLogger(CompleteTicketAttachmentUploadCommandHandler.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    @Inject(STORAGE_CLIENT) private readonly storageClient: IStorageClient,
    private readonly ticketAttachmentRepository: TicketAttachmentRepository,
    private readonly ticketRepository: TicketRepository,
  ) { }

  async execute(command: CompleteTicketAttachmentUploadCommand): Promise<TicketAttachmentResponseDto> {
    const { ticketId, attachmentId } = command;

    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundException(TICKETS_ERRORS.TICKET_NOT_FOUND(ticketId));

    const attachment = await this.ticketAttachmentRepository.findById(attachmentId);
    if (!attachment || attachment.ticketId !== ticketId) {
      throw new NotFoundException(TICKETS_ERRORS.ATTACHMENT_NOT_FOUND(attachmentId));
    }

    const updated = await this.processAttachment(attachment);
    return plainToInstance(TicketAttachmentResponseDto, updated, { excludeExtraneousValues: true });
  }

  private async processAttachment(attachment: TicketAttachmentSelect): Promise<TicketAttachmentSelect> {
    this.logger.info({ attachmentId: attachment.id, kind: attachment.kind }, 'Processing ticket attachment');

    try {
      const buffer = await this.storageClient.getObject(attachment.objectKey);
      const extractedText = await this.extractText(attachment.kind, buffer, attachment.mimeType);

      return this.ticketAttachmentRepository.updateProcessingResult(attachment.id, {
        processingStatus: 'completed',
        extractedText,
      });
    } catch (err) {
      const processingError = err instanceof Error ? err.message : 'Unknown processing error';
      this.logger.error({ err, attachmentId: attachment.id }, 'Attachment processing failed');

      return this.ticketAttachmentRepository.updateProcessingResult(attachment.id, {
        processingStatus: 'failed',
        processingError,
      });
    }
  }

  private extractText(kind: TicketAttachmentSelect['kind'], buffer: Buffer, mimeType: string): Promise<string> {
    return kind === 'screenshot' ? this.extractTextFromImage(buffer, mimeType) : this.transcribeAudio(buffer, mimeType);
  }

  @TrackAiUsage('TICKET_OCR')
  private async extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
    return this.aiClient.extractTextFromImage(buffer, mimeType);
  }

  @TrackAiUsage('TICKET_STT')
  private async transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
    return this.aiClient.transcribeAudio(buffer, mimeType);
  }
}
