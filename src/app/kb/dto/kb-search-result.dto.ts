import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class KbSearchResultDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  articleId!: string;

  @Expose()
  @ApiProperty({ type: Number })
  chunkIndex!: number;

  @Expose()
  @ApiProperty({ type: String })
  content!: string;

  @Expose()
  @ApiProperty({ type: Date })
  createdAt!: Date;
}
