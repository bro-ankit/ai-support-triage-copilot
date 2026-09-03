import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { InjectionHeuristicUtil } from '../../../../ai/injection-heuristic.util';
import { DiagnoseTicketAgent, type DiagnoseTicketResponse } from '../../agents/diagnose-ticket.agent';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';
import { TicketInvestigationResultUtil } from '../ticket-investigation-result.util';

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

    const diagnosis = await this.diagnoseSafely(state);
    if (!diagnosis) {
      return { earlyResult: TicketInvestigationResultUtil.diagnosisFailedResult(state.retrievedChunkIds) };
    }

    if (diagnosis.confidence < DiagnoseNode.DIAGNOSIS_CONFIDENCE_THRESHOLD) {
      this.logger.warn(
        { ticketId: state.ticketId, confidence: diagnosis.confidence },
        'Diagnosis confidence too low, skipping propose-action',
      );
      return {
        diagnosis,
        earlyResult: TicketInvestigationResultUtil.needsReviewResult(state.retrievedChunkIds, diagnosis),
      };
    }
    return { diagnosis };
  }

  private async diagnoseSafely(state: TicketInvestigationGraphState): Promise<DiagnoseTicketResponse | null> {
    const kbFindingsText = state.kbChunks.map((c) => c.content).join('\n\n---\n\n');
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
