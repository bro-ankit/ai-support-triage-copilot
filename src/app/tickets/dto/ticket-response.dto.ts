import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { TICKET_ATTACHMENT_KINDS, TICKET_ATTACHMENT_PROCESSING_STATUSES } from '../../../schema/ticket-attachments.schema';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../../../schema/tickets.schema';

export class TicketAttachmentResponseDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @Expose()
  @ApiProperty({ enum: TICKET_ATTACHMENT_KINDS, enumName: 'TicketAttachmentKind' })
  kind!: string;

  @Expose()
  @ApiProperty({ type: String })
  mimeType!: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  extractedText!: string | null;

  @Expose()
  @ApiProperty({ enum: TICKET_ATTACHMENT_PROCESSING_STATUSES, enumName: 'TicketAttachmentProcessingStatus' })
  processingStatus!: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  processingError!: string | null;
}

export class TicketResponseDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @Expose()
  @ApiProperty({ type: String })
  subject!: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @Expose()
  @ApiProperty({ enum: TICKET_STATUSES, enumName: 'TicketStatus' })
  status!: string;

  @Expose()
  @ApiProperty({ enum: TICKET_PRIORITIES, enumName: 'TicketPriority' })
  priority!: string;

  @Expose()
  @Type(() => TicketAttachmentResponseDto)
  @ApiProperty({ type: [TicketAttachmentResponseDto] })
  attachments!: TicketAttachmentResponseDto[];

  @Expose()
  @ApiProperty({ type: Date })
  createdAt!: Date;
}
