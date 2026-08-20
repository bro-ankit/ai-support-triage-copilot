import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RequestAttachmentUploadResponseDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  attachmentId!: string;

  @Expose()
  @ApiProperty({ type: String, description: 'Presigned S3 POST URL the client submits the file to directly' })
  uploadUrl!: string;

  @Expose()
  @ApiProperty({
    type: Object,
    description:
      'Form fields the client must include in the multipart POST alongside the file, includes the ' +
      'signed size-limit policy so oversized uploads are rejected by S3 itself before any bytes are stored',
  })
  uploadFields!: Record<string, string>;

  @Expose()
  @ApiProperty({ type: String, description: 'S3-style object key the file was stored under' })
  objectKey!: string;
}
