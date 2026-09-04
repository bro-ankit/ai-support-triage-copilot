import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { KbChunkSelect } from '../../../../schema/kb-chunks.schema';
import { MULTI_HOP_DEFAULTS } from '../../../kb/search/kb-search.constants';
import { KbSearchService } from '../../../kb/search/kb-search.service';
import { MultiHopQueryAgent } from '../../agents/multi-hop-query.agent';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';
import { TicketInvestigationResultUtil } from '../ticket-investigation-result.util';
import { KbCitationUtil } from './kb-citation.util';

@Injectable()
export class RetrieveNode implements ITicketInvestigationNode {
  constructor(
    @InjectPinoLogger(RetrieveNode.name) private readonly logger: PinoLogger,
    private readonly kbSearchService: KbSearchService,
    private readonly multiHopQueryAgent: MultiHopQueryAgent,
  ) {}

  async run(state: TicketInvestigationGraphState): Promise<Partial<TicketInvestigationGraphState>> {
    this.logger.debug({ ticketId: state.ticketId }, 'Running retrieve node');
    const hop1 = await this.kbSearchService.search(state.searchQuery);

    if (hop1.chunks.length === 0) {
      this.logger.warn({ ticketId: state.ticketId }, 'No KB findings retrieved, skipping diagnosis');
      return { kbChunks: [], earlyResult: TicketInvestigationResultUtil.noFindingsResult() };
    }

    const kbChunks = hop1.isConfident ? hop1.chunks : await this.retrieveFollowUpHops(state, hop1.chunks);
    return { kbChunks, retrievedChunkIds: kbChunks.map((c) => c.id) };
  }

  private async retrieveFollowUpHops(
    state: TicketInvestigationGraphState,
    hop1Chunks: KbChunkSelect[],
  ): Promise<KbChunkSelect[]> {
    const { text: hop1FindingsText } = KbCitationUtil.buildLabeledFindings(hop1Chunks);
    const followUpQueries = await this.multiHopQueryAgent.generateFollowUpQueries(state.ticket, hop1FindingsText);

    if (followUpQueries.length === 0) {
      this.logger.debug({ ticketId: state.ticketId }, 'Low-confidence hop 1, but no follow-up queries proposed');
      return hop1Chunks;
    }

    this.logger.info({ ticketId: state.ticketId, followUpQueries }, 'Retrieving follow-up hops');
    const followUpHops = await Promise.all(followUpQueries.map((q) => this.kbSearchService.search(q)));

    const merged = new Map<string, KbChunkSelect>(hop1Chunks.map((c) => [c.id, c]));
    for (const hop of followUpHops) {
      for (const chunk of hop.chunks) merged.set(chunk.id, chunk);
    }

    return [...merged.values()].slice(
      0,
      MULTI_HOP_DEFAULTS.MAX_FOLLOW_UP_QUERIES * hop1Chunks.length + hop1Chunks.length,
    );
  }
}
