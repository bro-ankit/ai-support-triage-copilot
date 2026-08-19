import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class IngestKbArticleResponseDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @Expose()
  @ApiProperty({ type: String })
  title!: string;

  @Expose()
  @ApiProperty({ type: Number, description: 'Number of chunks the article was split into' })
  chunkCount!: number;
}
