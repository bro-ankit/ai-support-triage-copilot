import { randomUUID, type UUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { TicketInvestigationSelect } from '../../../schema/ticket-investigations.schema';
import type { TicketSelect } from '../../../schema/tickets.schema';
import { Traced } from '../../../tracing/traced.decorator';
import { TicketInvestigationProgressEvent } from '../events/ticket-investigation-progress.event';
import { EpisodicMemoryService } from '../memory/episodic-memory.service';
import { TicketInvestigationRepository } from '../repositories/ticket-investigation.repository';
import { TICKETS_ERRORS } from '../tickets.constants';
import { TicketClassificationStepService } from './steps/ticket-classification-step.service';
import { TicketDiagnosisStepService } from './steps/ticket-diagnosis-step.service';
import { TicketInvestigationContextService } from './ticket-investigation-context.service';

@Injectable()
export class TicketInvestigationOrchestratorService {
  constructor(
    @InjectPinoLogger(TicketInvestigationOrchestratorService.name) private readonly logger: PinoLogger,
    private readonly contextService: TicketInvestigationContextService,
    private readonly classificationStep: TicketClassificationStepService,
    private readonly diagnosisStep: TicketDiagnosisStepService,
    private readonly episodicMemoryService: EpisodicMemoryService,
    private readonly ticketInvestigationRepository: TicketInvestigationRepository,
    private readonly eventBus: EventBus,
  ) { }

  @Traced<[UUID, AbortSignal?], TicketInvestigationSelect>(
    'ticket_investigation',
    (ticketId) => ({ 'ticket.id': ticketId }),
    (investigation) => ({ 'investigation.status': investigation.status }),
  )
  async investigate(ticketId: UUID, abortSignal?: AbortSignal): Promise<TicketInvestigationSelect> {
    this.logger.info({ ticketId }, 'Starting ticket investigation');

    const { ticket, attachmentText } = await this.contextService.load(ticketId);
    this.publish(ticketId, 'context_loaded', 'Loaded ticket and attachment context');

    this.throwIfAborted(ticketId, abortSignal);
    await this.classificationStep.run(ticket, attachmentText);
    this.publish(ticketId, 'classified', 'Classified ticket category and priority');

    this.throwIfAborted(ticketId, abortSignal);
    this.logger.debug({ ticketId }, 'Handing off to diagnosis step');
    const result = await this.diagnosisStep.run(ticket, this.buildSearchQuery(ticket, attachmentText), abortSignal);

    const episodeEmbedding = await this.episodicMemoryService.embedEpisode(ticket, result);
    this.logger.info({ ticketId, status: result.status }, 'Ticket investigation complete');
    return this.ticketInvestigationRepository.insert({ id: randomUUID(), ticketId, episodeEmbedding, ...result });
  }

  private throwIfAborted(ticketId: UUID, abortSignal?: AbortSignal): void {
    if (!abortSignal?.aborted) return;
    this.logger.info({ ticketId }, 'Investigation aborted, client disconnected');
    throw new Error(TICKETS_ERRORS.INVESTIGATION_ABORTED);
  }

  private publish(ticketId: UUID, stage: TicketInvestigationProgressEvent['stage'], message: string): void {
    this.eventBus.publish(new TicketInvestigationProgressEvent(ticketId, stage, message));
  }

  private buildSearchQuery(ticket: TicketSelect, attachmentText: string): string {
    return [ticket.subject, ticket.description, attachmentText].filter(Boolean).join('\n');
  }
}
