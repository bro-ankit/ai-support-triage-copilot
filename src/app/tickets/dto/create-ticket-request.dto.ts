import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { TICKET_PRIORITIES, type TicketPriority } from '../../../schema/tickets.schema';

export class CreateTicketRequestDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TICKET_PRIORITIES, enumName: 'TicketPriority' })
  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriority;
}
