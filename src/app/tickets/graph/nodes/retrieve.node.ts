import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { KbSearchService } from '../../../kb/search/kb-search.service';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';
import { TicketInvestigationResultUtil } from '../ticket-investigation-result.util';

@Injectable()
export class RetrieveNode implements ITicketInvestigationNode {
  constructor(
    @InjectPinoLogger(RetrieveNode.name) private readonly logger: PinoLogger,
    private readonly kbSearchService: KbSearchService,
  ) {}

  async run(state: TicketInvestigationGraphState): Promise<Partial<TicketInvestigationGraphState>> {
    this.logger.debug({ ticketId: state.ticketId }, 'Running retrieve node');
    const kbChunks = await this.kbSearchService.search(state.searchQuery);

    if (kbChunks.length === 0) {
      this.logger.warn({ ticketId: state.ticketId }, 'No KB findings retrieved, skipping diagnosis');
      return { kbChunks, earlyResult: TicketInvestigationResultUtil.noFindingsResult() };
    }
    return { kbChunks, retrievedChunkIds: kbChunks.map((c) => c.id) };
  }
}
