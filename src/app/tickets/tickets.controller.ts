import type { UUID } from 'node:crypto';

import { Body, Controller, Get, MessageEvent, Param, Post, Sse, SseSignal } from '@nestjs/common';
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';

import { AUTH_SCOPES } from '../../auth/auth.constants';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { RequireAuth } from '../../auth/decorators/require-auth.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { SseProgressStreamUtil } from '../../sse/sse-progress-stream.util';
import { ApproveTicketActionCommand } from './commands/approve-ticket-action.command';
import { CompleteTicketAttachmentUploadCommand } from './commands/complete-ticket-attachment-upload.command';
import { CreateTicketCommand } from './commands/create-ticket.command';
import { ExecuteTicketActionCommand } from './commands/execute-ticket-action.command';
import { InvestigateTicketCommand } from './commands/investigate-ticket.command';
import { RequestTicketAttachmentUploadCommand } from './commands/request-ticket-attachment-upload.command';
import { CreateTicketRequestDto } from './dto/create-ticket-request.dto';
import { RequestAttachmentUploadRequestDto } from './dto/request-attachment-upload-request.dto';
import { RequestAttachmentUploadResponseDto } from './dto/request-attachment-upload-response.dto';
import { TicketActionApprovalResponseDto } from './dto/ticket-action-approval-response.dto';
import { TicketInvestigationResponseDto } from './dto/ticket-investigation-response.dto';
import { TicketAttachmentResponseDto, TicketResponseDto } from './dto/ticket-response.dto';
import { TicketInvestigationProgressEvent } from './events/ticket-investigation-progress.event';
import { GetTicketQuery } from './queries/get-ticket.query';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly eventBus: EventBus,
  ) {}

  @Post()
  @RequireAuth(AUTH_SCOPES.MCP)
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiOkResponse({ type: TicketResponseDto })
  create(@Body() dto: CreateTicketRequestDto): Promise<TicketResponseDto> {
    return this.commandBus.execute(new CreateTicketCommand(dto));
  }

  @Post(':id/attachments/presign')
  @RequireAuth(AUTH_SCOPES.MCP)
  @ApiOperation({ summary: 'Request a presigned URL to upload a ticket attachment directly to object storage' })
  @ApiOkResponse({ type: RequestAttachmentUploadResponseDto })
  requestAttachmentUpload(
    @Param('id') ticketId: UUID,
    @Body() dto: RequestAttachmentUploadRequestDto,
  ): Promise<RequestAttachmentUploadResponseDto> {
    return this.commandBus.execute(new RequestTicketAttachmentUploadCommand(ticketId, dto));
  }

  @Post(':id/attachments/:attachmentId/complete')
  @RequireAuth(AUTH_SCOPES.MCP)
  @ApiOperation({ summary: 'Signal that a direct-to-storage upload finished; triggers OCR/STT extraction' })
  @ApiOkResponse({ type: TicketAttachmentResponseDto })
  completeAttachmentUpload(
    @Param('id') ticketId: UUID,
    @Param('attachmentId') attachmentId: UUID,
  ): Promise<TicketAttachmentResponseDto> {
    return this.commandBus.execute(new CompleteTicketAttachmentUploadCommand(ticketId, attachmentId));
  }

  @Get(':id')
  @RequireAuth(AUTH_SCOPES.MCP)
  @ApiOperation({ summary: 'Get a ticket with its attachments and any extracted text' })
  @ApiOkResponse({ type: TicketResponseDto })
  getTicket(@Param('id') ticketId: UUID): Promise<TicketResponseDto> {
    return this.queryBus.execute(new GetTicketQuery(ticketId));
  }

  @Post(':id/investigate')
  @RequireAuth(AUTH_SCOPES.MCP)
  @Sse()
  @ApiOperation({
    summary:
      'Run the ticket investigation pipeline live over Server-Sent Events: classify, retrieve relevant ' +
      'KB articles, diagnose, and propose a customer-facing action (subject to a later human approval ' +
      'gate). The pipeline runs for several seconds, so every call streams progress as it happens ' +
      'rather than leaving the caller on a blocking loading screen.',
  })
  investigate(
    @Param('id') ticketId: UUID,
    @SseSignal() signal: AbortSignal,
  ): Observable<MessageEvent> {
    return SseProgressStreamUtil.build({
      eventBus: this.eventBus,
      eventType: TicketInvestigationProgressEvent,
      matches: (event) => event.ticketId === ticketId,
      mapProgress: (event) => ({ type: 'progress', data: { stage: event.stage, message: event.message } }),
      execute: () => this.commandBus.execute<InvestigateTicketCommand, TicketInvestigationResponseDto>(
        new InvestigateTicketCommand(ticketId, signal),
      ),
      mapResult: (investigation) => ({ type: 'result', data: investigation }),
      abortSignal: signal,
    });
  }

  @Post(':id/investigations/:investigationId/approvals')
  @RequireAuth(AUTH_SCOPES.APPROVE_ACTIONS)
  @ApiOperation({
    summary:
      'Approve the action an investigation proposed. Requires the approve_actions scope, a separate, ' +
      'audited path from the mcp scope an investigation-running caller holds, so a caller cannot ' +
      'approve its own proposed action.',
  })
  @ApiOkResponse({ type: TicketActionApprovalResponseDto })
  approveAction(
    @Param('id') ticketId: UUID,
    @Param('investigationId') investigationId: UUID,
    @CurrentAuth() auth: AuthenticatedUser,
  ): Promise<TicketActionApprovalResponseDto> {
    return this.commandBus.execute(new ApproveTicketActionCommand(ticketId, investigationId, auth.userId));
  }

  @Post(':id/investigations/:investigationId/execute')
  @RequireAuth()
  @ApiOperation({
    summary:
      'Execute a previously approved action. Atomically consumes the approval record so it cannot ' +
      'be replayed; fails if no approval exists, the approval already expired, or it was already consumed.',
  })
  @ApiOkResponse({ type: TicketInvestigationResponseDto })
  executeAction(
    @Param('id') ticketId: UUID,
    @Param('investigationId') investigationId: UUID,
  ): Promise<TicketInvestigationResponseDto> {
    return this.commandBus.execute(new ExecuteTicketActionCommand(ticketId, investigationId));
  }
}
