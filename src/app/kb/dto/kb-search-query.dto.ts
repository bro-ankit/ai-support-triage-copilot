import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class KbSearchQueryDto {
  @ApiProperty({ type: String, description: 'Natural language query to search the KB semantically' })
  @IsString()
  @IsNotEmpty()
  q!: string;
}
