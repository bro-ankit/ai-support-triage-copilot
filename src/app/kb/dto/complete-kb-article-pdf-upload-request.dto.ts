import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

import { KB_SOURCE_TYPES, type KbSourceType } from '../../../schema/kb-articles.schema';

export class CompleteKbArticlePdfUploadRequestDto {
  @ApiProperty({ type: String, description: 'Object key returned by the presign step' })
  @IsString()
  @IsNotEmpty()
  objectKey!: string;

  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ enum: KB_SOURCE_TYPES, enumName: 'KbSourceType' })
  @IsIn(KB_SOURCE_TYPES)
  sourceType!: KbSourceType;
}
