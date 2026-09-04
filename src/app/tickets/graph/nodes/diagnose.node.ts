import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { InjectionHeuristicUtil } from '../../../../ai/injection-heuristic.util';
import { DiagnoseTicketAgent, type DiagnoseTicketResponse } from '../../agents/diagnose-ticket.agent';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';
import { TicketInvestigationResultUtil } from '../ticket-investigation-result.util';
import { KbCitationUtil } from './kb-citation.util';

@Injectable()
export class DiagnoseNode implements ITicketInvestigationNode {
  private static readonly DIAGNOSIS_CONFIDENCE_THRESHOLD = 0.5;

  constructor(
    @InjectPinoLogger(DiagnoseNode.name) private readonly logger: PinoLogger,
    private readonly diagnoseTicketAgent: DiagnoseTicketAgent,
  ) {}

  async run(state: TicketInvestigationGraphState): Promise<Partial<TicketInvestigationGraphState>> {
    this.logger.debug({ ticketId: state.ticketId }, 'Running diagnose node');
    const suspiciousChunkIds = state.kbChunks
      .filter((c) => InjectionHeuristicUtil.looksLikeInjectionAttempt(c.content))
      .map((c) => c.id);
    if (suspiciousChunkIds.length > 0) {
      this.logger.warn(
        { ticketId: state.ticketId, suspiciousChunkIds },
        'Possible prompt injection attempt detected in retrieved KB content',
      );
    }

    const { text: kbFindingsText, labelToChunkId } = KbCitationUtil.buildLabeledFindings(state.kbChunks);
    const diagnosis = await this.diagnoseSafely(state, kbFindingsText);
    if (!diagnosis) {
      return { earlyResult: TicketInvestigationResultUtil.diagnosisFailedResult(state.retrievedChunkIds) };
    }

    const citedChunkIds = KbCitationUtil.extractCitedChunkIds(diagnosis.diagnosis, labelToChunkId);

    if (diagnosis.confidence < DiagnoseNode.DIAGNOSIS_CONFIDENCE_THRESHOLD) {
      this.logger.warn(
        { ticketId: state.ticketId, confidence: diagnosis.confidence },
        'Diagnosis confidence too low, skipping propose-action',
      );
      return {
        diagnosis,
        citedChunkIds,
        earlyResult: TicketInvestigationResultUtil.needsReviewResult(state.retrievedChunkIds, diagnosis, citedChunkIds),
      };
    }

    if (state.kbChunks.length > 0 && citedChunkIds.length === 0) {
      this.logger.warn({ ticketId: state.ticketId }, 'Diagnosis cited no retrieved KB chunks, skipping propose-action');
      return {
        diagnosis,
        citedChunkIds,
        earlyResult: TicketInvestigationResultUtil.needsReviewResult(state.retrievedChunkIds, diagnosis, citedChunkIds),
      };
    }

    return { diagnosis, citedChunkIds };
  }

  private async diagnoseSafely(
    state: TicketInvestigationGraphState,
    kbFindingsText: string,
  ): Promise<DiagnoseTicketResponse | null> {
    const pastCasesText = this.formatPastCases(state.pastCases);
    try {
      return await this.diagnoseTicketAgent.diagnose(state.ticket, kbFindingsText, pastCasesText);
    } catch (err) {
      this.logger.warn({ ticketId: state.ticketId, err }, 'Diagnosis failed');
      return null;
    }
  }

  private formatPastCases(pastCases: TicketInvestigationGraphState['pastCases']): string {
    return pastCases
      .map(
        (c) =>
          `Past ticket: ${c.subject}\nDescription: ${c.description ?? '(none provided)'}\n` +
          `Diagnosis: ${c.diagnosis}\nResolution: ${c.proposedAction ?? '(none)'}`,
      )
      .join('\n\n---\n\n');
  }
}
