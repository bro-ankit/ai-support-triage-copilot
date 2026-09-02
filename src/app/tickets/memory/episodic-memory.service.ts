import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { IAiClient } from '../../../ai/ai.interface';
import { TrackAiUsage } from '../../../metrics/track-ai-usage.decorator';
import type { TicketSelect } from '../../../schema/tickets.schema';
import { Traced } from '../../../tracing/traced.decorator';
import { TicketInvestigationRepository } from '../repositories/ticket-investigation.repository';
import type { TicketDiagnosisStepResult } from '../orchestrator/steps/ticket-diagnosis-step.service';
import { EPISODIC_MEMORY_DEFAULTS } from './episodic-memory.constants';
import type { SimilarPastCase } from './episodic-memory.types';

@Injectable()
export class EpisodicMemoryService {
  constructor(
    @InjectPinoLogger(EpisodicMemoryService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly ticketInvestigationRepository: TicketInvestigationRepository,
  ) {}

  @Traced<[string, UUID], SimilarPastCase[]>(
    'recall',
    (_query, excludeTicketId) => ({ 'ticket.id': excludeTicketId }),
    (results) => ({ 'episodic.cases_found': results.length }),
  )
  @TrackAiUsage('EMBEDDING')
  async recall(query: string, excludeTicketId: UUID): Promise<SimilarPastCase[]> {
    const embedding = await this.aiClient.generateEmbedding(query);
    const cases = await this.ticketInvestigationRepository.findSimilarCases(
      embedding,
      excludeTicketId,
      EPISODIC_MEMORY_DEFAULTS.CANDIDATE_K,
      EPISODIC_MEMORY_DEFAULTS.MAX_DISTANCE,
    );
    this.logger.debug({ excludeTicketId, casesFound: cases.length }, 'Episodic recall complete');
    return cases;
  }

  @TrackAiUsage('EMBEDDING')
  async embedEpisode(ticket: TicketSelect, result: TicketDiagnosisStepResult): Promise<number[] | null> {
    if (result.status !== 'completed') return null;

    const episodeText = [
      `Subject: ${ticket.subject}`,
      `Description: ${ticket.description ?? '(none provided)'}`,
      `Diagnosis: ${result.diagnosis}`,
      `Resolution: ${result.proposedAction ?? '(none)'}`,
    ].join('\n');

    return this.aiClient.generateEmbedding(episodeText);
  }
}
