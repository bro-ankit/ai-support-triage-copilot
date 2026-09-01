import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RequestKbArticlePdfUploadRequestDto {
  @ApiProperty({ type: String, description: 'Original filename, used to build the object key' })
  @IsString()
  @IsNotEmpty()
  filename!: string;
}
