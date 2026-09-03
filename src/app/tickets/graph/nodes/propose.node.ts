import type { UUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ProposeTicketActionAgent, type ProposeTicketActionResponse } from '../../agents/propose-ticket-action.agent';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';
import { TicketInvestigationResultUtil } from '../ticket-investigation-result.util';

@Injectable()
export class ProposeNode implements ITicketInvestigationNode {
  constructor(
    @InjectPinoLogger(ProposeNode.name) private readonly logger: PinoLogger,
    private readonly proposeTicketActionAgent: ProposeTicketActionAgent,
  ) {}

  async run(state: TicketInvestigationGraphState): Promise<Partial<TicketInvestigationGraphState>> {
    this.logger.debug({ ticketId: state.ticketId }, 'Running propose node');
    if (!state.diagnosis) {
      throw new Error(`Ticket investigation graph reached propose for ${state.ticketId} without a diagnosis`);
    }

    const proposal = await this.proposeSafely(state.ticketId, state.ticket, state.diagnosis);
    if (!proposal) {
      return { earlyResult: TicketInvestigationResultUtil.needsReviewResult(state.retrievedChunkIds, state.diagnosis) };
    }

    this.logger.info({ ticketId: state.ticketId, action: proposal.action }, 'Propose-action step complete');
    return {
      earlyResult: {
        retrievedChunkIds: state.retrievedChunkIds,
        diagnosis: state.diagnosis.diagnosis,
        diagnosisConfidence: state.diagnosis.confidence,
        proposedAction: proposal.action,
        proposedActionReasoning: proposal.reasoning,
        status: 'completed',
      },
    };
  }

  private async proposeSafely(
    ticketId: UUID,
    ticket: TicketInvestigationGraphState['ticket'],
    diagnosis: NonNullable<TicketInvestigationGraphState['diagnosis']>,
  ): Promise<ProposeTicketActionResponse | null> {
    try {
      return await this.proposeTicketActionAgent.propose(ticket, diagnosis);
    } catch (err) {
      this.logger.warn({ ticketId, err }, 'Propose-action failed');
      return null;
    }
  }
}
