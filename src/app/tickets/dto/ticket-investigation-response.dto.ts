import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { TICKET_INVESTIGATION_STATUSES, TICKET_PROPOSED_ACTIONS } from '../../../schema/ticket-investigations.schema';

export class TicketInvestigationResponseDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @Expose()
  @ApiProperty({ type: [String], format: 'uuid' })
  retrievedChunkIds!: string[];

  @Expose()
  @ApiProperty({ type: String })
  diagnosis!: string;

  @Expose()
  @ApiProperty({ type: Number })
  diagnosisConfidence!: number;

  @Expose()
  @ApiProperty({ enum: TICKET_PROPOSED_ACTIONS, enumName: 'TicketProposedAction', nullable: true })
  proposedAction!: string | null;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  proposedActionReasoning!: string | null;

  @Expose()
  @ApiProperty({ enum: TICKET_INVESTIGATION_STATUSES, enumName: 'TicketInvestigationStatus' })
  status!: string;

  @Expose()
  @ApiProperty({ type: Date })
  createdAt!: Date;
}
