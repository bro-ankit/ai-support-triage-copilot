import type { Runtime } from '@langchain/langgraph';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TenantContextService } from '../../../../auth/tenant-context.service';
import { TICKET_EPISODIC_MEMORY_DEFAULTS } from '../../memory/ticket-episodic-memory.constants';
import { TicketEpisodicMemoryUtil } from '../../memory/ticket-episodic-memory.util';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';

@Injectable()
export class RecallNode implements ITicketInvestigationNode {
  constructor(
    @InjectPinoLogger(RecallNode.name) private readonly logger: PinoLogger,
    private readonly tenantContext: TenantContextService,
  ) {}

  async run(state: TicketInvestigationGraphState, runtime: Runtime): Promise<Partial<TicketInvestigationGraphState>> {
    this.logger.debug({ ticketId: state.ticketId }, 'Running recall node');

    const store = runtime.store as PostgresStore;
    const namespace = TicketEpisodicMemoryUtil.namespace(this.tenantContext.getTenantId());
    const items = await store.search(namespace, {
      query: state.searchQuery,
      mode: 'vector',
      limit: TICKET_EPISODIC_MEMORY_DEFAULTS.CANDIDATE_K,
      similarityThreshold: TICKET_EPISODIC_MEMORY_DEFAULTS.SIMILARITY_THRESHOLD,
      filter: { ticketId: { $ne: state.ticketId } },
    });

    const pastCases = items.map(TicketEpisodicMemoryUtil.toSimilarPastCase);
    this.logger.debug({ ticketId: state.ticketId, casesFound: pastCases.length }, 'Episodic recall complete');
    return { pastCases };
  }
}
