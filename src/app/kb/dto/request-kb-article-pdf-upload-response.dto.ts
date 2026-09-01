import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RequestKbArticlePdfUploadResponseDto {
  @Expose()
  @ApiProperty({ type: String, description: 'Presigned S3 POST URL the client submits the file to directly' })
  uploadUrl!: string;

  @Expose()
  @ApiProperty({
    type: Object,
    description:
      'Server-generated form fields, copy verbatim into the multipart POST alongside the file field. ' +
      'Includes the signed size-limit policy so oversized uploads are rejected by S3 itself before any ' +
      'bytes are stored. Nothing here is filled in by the caller.',
    example: {
      key: 'kb-articles/1a2b3c4d-postmortem.pdf',
      'Content-Type': 'application/pdf',
      policy: '<base64-encoded signed policy>',
      'x-amz-algorithm': 'AWS4-HMAC-SHA256',
      'x-amz-credential': '<access-key>/20260827/us-east-1/s3/aws4_request',
      'x-amz-date': '20260827T000000Z',
      'x-amz-signature': '<hex-encoded signature>',
    },
  })
  uploadFields!: Record<string, string>;

  @Expose()
  @ApiProperty({ type: String, description: 'Object key to pass to the complete endpoint once the upload finishes' })
  objectKey!: string;
}
