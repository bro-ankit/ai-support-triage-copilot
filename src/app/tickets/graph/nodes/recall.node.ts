import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { EpisodicMemoryService } from '../../memory/episodic-memory.service';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';

@Injectable()
export class RecallNode implements ITicketInvestigationNode {
  constructor(
    @InjectPinoLogger(RecallNode.name) private readonly logger: PinoLogger,
    private readonly episodicMemoryService: EpisodicMemoryService,
  ) {}

  async run(state: TicketInvestigationGraphState): Promise<Partial<TicketInvestigationGraphState>> {
    this.logger.debug({ ticketId: state.ticketId }, 'Running recall node');
    const pastCases = await this.episodicMemoryService.recall(state.searchQuery, state.ticketId);
    return { pastCases };
  }
}
