import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

import { TICKET_ATTACHMENT_KINDS, type TicketAttachmentKind } from '../../../schema/ticket-attachments.schema';

export class RequestAttachmentUploadRequestDto {
  @ApiProperty({ enum: TICKET_ATTACHMENT_KINDS, enumName: 'TicketAttachmentKind' })
  @IsIn(TICKET_ATTACHMENT_KINDS)
  kind!: TicketAttachmentKind;

  @ApiProperty({ type: String, description: 'Original filename, used to build the object key' })
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @ApiProperty({ type: String, description: 'MIME type of the file to be uploaded' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;
}
