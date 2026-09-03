import type { UUID } from 'node:crypto';

import type { DiagnoseTicketResponse } from '../agents/diagnose-ticket.agent';
import type { TicketInvestigationResult } from '../ticket-investigation-result.types';

export class TicketInvestigationResultUtil {
  static noFindingsResult(): TicketInvestigationResult {
    return {
      retrievedChunkIds: [],
      diagnosis: 'No relevant knowledge-base articles were found for this ticket.',
      diagnosisConfidence: 0,
      proposedAction: null,
      proposedActionReasoning: null,
      status: 'needs_review',
    };
  }

  static diagnosisFailedResult(retrievedChunkIds: UUID[]): TicketInvestigationResult {
    return {
      retrievedChunkIds,
      diagnosis: '(diagnosis failed, see logs for the underlying error)',
      diagnosisConfidence: 0,
      proposedAction: null,
      proposedActionReasoning: null,
      status: 'failed',
    };
  }

  static needsReviewResult(retrievedChunkIds: UUID[], diagnosis: DiagnoseTicketResponse): TicketInvestigationResult {
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
