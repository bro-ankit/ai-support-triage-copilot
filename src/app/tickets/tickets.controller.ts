import type { UUID } from 'node:crypto';

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CompleteTicketAttachmentUploadCommand } from './commands/complete-ticket-attachment-upload.command';
import { CreateTicketCommand } from './commands/create-ticket.command';
import { RequestTicketAttachmentUploadCommand } from './commands/request-ticket-attachment-upload.command';
import { CreateTicketRequestDto } from './dto/create-ticket-request.dto';
import { RequestAttachmentUploadRequestDto } from './dto/request-attachment-upload-request.dto';
import { RequestAttachmentUploadResponseDto } from './dto/request-attachment-upload-response.dto';
import { TicketAttachmentResponseDto, TicketResponseDto } from './dto/ticket-response.dto';
import { GetTicketQuery } from './queries/get-ticket.query';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiOkResponse({ type: TicketResponseDto })
  create(@Body() dto: CreateTicketRequestDto): Promise<TicketResponseDto> {
    return this.commandBus.execute(new CreateTicketCommand(dto));
  }

  @Post(':id/attachments/presign')
  @ApiOperation({ summary: 'Request a presigned URL to upload a ticket attachment directly to object storage' })
  @ApiOkResponse({ type: RequestAttachmentUploadResponseDto })
  requestAttachmentUpload(
    @Param('id') ticketId: UUID,
    @Body() dto: RequestAttachmentUploadRequestDto,
  ): Promise<RequestAttachmentUploadResponseDto> {
    return this.commandBus.execute(new RequestTicketAttachmentUploadCommand(ticketId, dto));
  }

  @Post(':id/attachments/:attachmentId/complete')
  @ApiOperation({ summary: 'Signal that a direct-to-storage upload finished; triggers OCR/STT extraction' })
  @ApiOkResponse({ type: TicketAttachmentResponseDto })
  completeAttachmentUpload(
    @Param('id') ticketId: UUID,
    @Param('attachmentId') attachmentId: UUID,
  ): Promise<TicketAttachmentResponseDto> {
    return this.commandBus.execute(new CompleteTicketAttachmentUploadCommand(ticketId, attachmentId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ticket with its attachments and any extracted text' })
  @ApiOkResponse({ type: TicketResponseDto })
  getTicket(@Param('id') ticketId: UUID): Promise<TicketResponseDto> {
    return this.queryBus.execute(new GetTicketQuery(ticketId));
  }
}
