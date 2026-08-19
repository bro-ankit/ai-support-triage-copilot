import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

import { KB_SOURCE_TYPES, type KbSourceType } from '../../../schema/kb-articles.schema';

export class IngestKbArticleRequestDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ enum: KB_SOURCE_TYPES, enumName: 'KbSourceType' })
  @IsIn(KB_SOURCE_TYPES)
  sourceType!: KbSourceType;

  @ApiProperty({ type: String, description: 'Full raw article/postmortem content, markdown or plain text' })
  @IsString()
  @IsNotEmpty()
  rawContent!: string;
}
