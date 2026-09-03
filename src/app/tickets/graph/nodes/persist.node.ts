import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { EpisodicMemoryService } from '../../memory/episodic-memory.service';
import { TicketInvestigationRepository } from '../../repositories/ticket-investigation.repository';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';

@Injectable()
export class PersistNode implements ITicketInvestigationNode {
  constructor(
    @InjectPinoLogger(PersistNode.name) private readonly logger: PinoLogger,
    private readonly episodicMemoryService: EpisodicMemoryService,
    private readonly ticketInvestigationRepository: TicketInvestigationRepository,
  ) {}

  async run(state: TicketInvestigationGraphState): Promise<Partial<TicketInvestigationGraphState>> {
    if (!state.earlyResult) {
      throw new Error(`Ticket investigation graph reached persist for ${state.ticketId} without a result`);
    }

    this.logger.debug({ ticketId: state.ticketId, status: state.earlyResult.status }, 'Running persist node');
    const episodeEmbedding = await this.episodicMemoryService.embedEpisode(state.ticket, state.earlyResult);
    const investigation = await this.ticketInvestigationRepository.insert({
      id: randomUUID(),
      ticketId: state.ticketId,
      episodeEmbedding,
      ...state.earlyResult,
    });
    this.logger.info({ ticketId: state.ticketId, status: investigation.status }, 'Ticket investigation persisted');
    return { investigation };
  }
}
