import type { UUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { InjectionHeuristicUtil } from '../../../../ai/injection-heuristic.util';
import type { KbChunkSelect } from '../../../../schema/kb-chunks.schema';
import type { TicketSelect } from '../../../../schema/tickets.schema';
import { KbSearchService } from '../../../kb/search/kb-search.service';
import { DiagnoseTicketAgent, type DiagnoseTicketResponse } from '../../agents/diagnose-ticket.agent';
import { ProposeTicketActionAgent } from '../../agents/propose-ticket-action.agent';
import { TicketInvestigationProgressEvent } from '../../events/ticket-investigation-progress.event';
import { TICKETS_ERRORS } from '../../tickets.constants';
import { TicketInvestigationInsert } from '../../../../schema';

type TicketDiagnosisStepResult = Omit<TicketInvestigationInsert, 'id' | 'ticketId' | 'createdAt'>

@Injectable()
export class TicketDiagnosisStepService {
  private static readonly DIAGNOSIS_CONFIDENCE_THRESHOLD = 0.5;


  constructor(
    @InjectPinoLogger(TicketDiagnosisStepService.name) private readonly logger: PinoLogger,
    private readonly kbSearchService: KbSearchService,
    private readonly diagnoseTicketAgent: DiagnoseTicketAgent,
    private readonly proposeTicketActionAgent: ProposeTicketActionAgent,
    private readonly eventBus: EventBus,
  ) { }

  async run(ticket: TicketSelect, searchQuery: string, abortSignal?: AbortSignal): Promise<TicketDiagnosisStepResult> {
    this.logger.debug({ ticketId: ticket.id }, 'Running ticket diagnosis step: retrieving KB findings');

    const kbChunks = await this.kbSearchService.search(searchQuery);
    this.publish(ticket.id, 'retrieved', `Retrieved ${kbChunks.length} knowledge-base chunk(s)`);
    if (kbChunks.length === 0) {
      this.logger.warn({ ticketId: ticket.id }, 'No KB findings retrieved, skipping diagnosis');
      return this.noFindingsResult();
    }

    this.logger.debug({ ticketId: ticket.id, chunkCount: kbChunks.length }, 'KB findings retrieved, diagnosing');
    const retrievedChunkIds = kbChunks.map((c) => c.id);

    const suspiciousChunkIds = kbChunks
      .filter((c) => InjectionHeuristicUtil.looksLikeInjectionAttempt(c.content))
      .map((c) => c.id);
    if (suspiciousChunkIds.length > 0) {
      this.logger.warn(
        { ticketId: ticket.id, suspiciousChunkIds },
        'Possible prompt injection attempt detected in retrieved KB content',
      );
    }

    this.throwIfAborted(ticket.id, abortSignal);
    const diagnosis = await this.diagnoseSafely(ticket, kbChunks);
    if (!diagnosis) {
      this.publish(ticket.id, 'diagnosed', 'Diagnosis failed');
      return this.diagnosisFailedResult(retrievedChunkIds);
    }
    this.publish(ticket.id, 'diagnosed', `Diagnosed with ${diagnosis.confidence} confidence`);

    this.logger.debug({ ticketId: ticket.id, confidence: diagnosis.confidence }, 'Diagnosis complete');
    if (diagnosis.confidence < TicketDiagnosisStepService.DIAGNOSIS_CONFIDENCE_THRESHOLD) {
      this.logger.warn(
        { ticketId: ticket.id, confidence: diagnosis.confidence },
        'Diagnosis confidence too low, skipping propose-action',
      );
      return this.needsReviewResult(retrievedChunkIds, diagnosis);
    }

    this.throwIfAborted(ticket.id, abortSignal);
    this.logger.debug({ ticketId: ticket.id }, 'Diagnosis confidence cleared threshold, proposing action');
    const proposal = await this.proposeSafely(ticket, diagnosis);
    if (!proposal) {
      this.publish(ticket.id, 'proposed', 'Propose-action failed');
      return this.needsReviewResult(retrievedChunkIds, diagnosis);
    }

    this.logger.info({ ticketId: ticket.id, action: proposal.action }, 'Propose-action step complete');
    this.publish(ticket.id, 'proposed', `Proposed action: ${proposal.action}`);
    return {
      retrievedChunkIds,
      diagnosis: diagnosis.diagnosis,
      diagnosisConfidence: diagnosis.confidence,
      proposedAction: proposal.action,
      proposedActionReasoning: proposal.reasoning,
      status: 'completed',
    };
  }

  private publish(ticketId: UUID, stage: TicketInvestigationProgressEvent['stage'], message: string): void {
    this.eventBus.publish(new TicketInvestigationProgressEvent(ticketId, stage, message));
  }

  private throwIfAborted(ticketId: UUID, abortSignal?: AbortSignal): void {
    if (!abortSignal?.aborted) return;
    this.logger.info({ ticketId }, 'Investigation aborted, client disconnected');
    throw new Error(TICKETS_ERRORS.INVESTIGATION_ABORTED);
  }

  private async diagnoseSafely(ticket: TicketSelect, kbChunks: KbChunkSelect[]): Promise<DiagnoseTicketResponse | null> {
    const kbFindingsText = kbChunks.map((c) => c.content).join('\n\n---\n\n');
    try {
      return await this.diagnoseTicketAgent.diagnose(ticket, kbFindingsText);
    } catch (err) {
      this.logger.warn({ ticketId: ticket.id, err }, 'Diagnosis failed');
      return null;
    }
  }

  private async proposeSafely(
    ticket: TicketSelect,
    diagnosis: DiagnoseTicketResponse,
  ): Promise<Awaited<ReturnType<ProposeTicketActionAgent['propose']>> | null> {
    try {
      return await this.proposeTicketActionAgent.propose(ticket, diagnosis);
    } catch (err) {
      this.logger.warn({ ticketId: ticket.id, err }, 'Propose-action failed');
      return null;
    }
  }

  private noFindingsResult(): TicketDiagnosisStepResult {
    return {
      retrievedChunkIds: [],
      diagnosis: 'No relevant knowledge-base articles were found for this ticket.',
      diagnosisConfidence: 0,
      proposedAction: null,
      proposedActionReasoning: null,
      status: 'needs_review',
    };
  }

  private diagnosisFailedResult(retrievedChunkIds: UUID[]): TicketDiagnosisStepResult {
    return {
      retrievedChunkIds,
      diagnosis: '(diagnosis failed, see logs for the underlying error)',
      diagnosisConfidence: 0,
      proposedAction: null,
      proposedActionReasoning: null,
      status: 'failed',
    };
  }

  private needsReviewResult(retrievedChunkIds: UUID[], diagnosis: DiagnoseTicketResponse): TicketDiagnosisStepResult {
    return {
      retrievedChunkIds,
      diagnosis: diagnosis.diagnosis,
      diagnosisConfidence: diagnosis.confidence,
      proposedAction: null,
      proposedActionReasoning: null,
      status: 'needs_review',
    };
  }
}
