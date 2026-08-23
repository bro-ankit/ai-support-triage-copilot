import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { TICKET_PROPOSED_ACTIONS } from '../../../schema/ticket-investigations.schema';

export class TicketActionApprovalResponseDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  ticketInvestigationId!: string;

  @Expose()
  @ApiProperty({ enum: TICKET_PROPOSED_ACTIONS, enumName: 'TicketProposedAction' })
  action!: string;

  @Expose()
  @ApiProperty({ type: String, description: 'Client ID of the caller that approved this action' })
  approvedBy!: string;

  @Expose()
  @ApiProperty({ type: Date })
  approvedAt!: Date;

  @Expose()
  @ApiProperty({ type: Date, description: 'The approval is no longer usable after this time' })
  expiresAt!: Date;
}
