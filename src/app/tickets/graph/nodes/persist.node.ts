import { randomUUID } from 'node:crypto';

import type { Runtime } from '@langchain/langgraph';
import type { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TenantContextService } from '../../../../auth/tenant-context.service';
import { TicketEpisodicMemoryUtil } from '../../memory/ticket-episodic-memory.util';
import { TicketInvestigationRepository } from '../../repositories/ticket-investigation.repository';
import type { TicketInvestigationGraphState } from '../ticket-investigation.state';
import type { ITicketInvestigationNode } from '../ticket-investigation-node.interface';

@Injectable()
export class PersistNode implements ITicketInvestigationNode {
  constructor(
    @InjectPinoLogger(PersistNode.name) private readonly logger: PinoLogger,
    private readonly tenantContext: TenantContextService,
    private readonly ticketInvestigationRepository: TicketInvestigationRepository,
  ) {}

  async run(state: TicketInvestigationGraphState, runtime: Runtime): Promise<Partial<TicketInvestigationGraphState>> {
    if (!state.earlyResult) {
      throw new Error(`Ticket investigation graph reached persist for ${state.ticketId} without a result`);
    }

    this.logger.debug({ ticketId: state.ticketId, status: state.earlyResult.status }, 'Running persist node');
    const investigation = await this.ticketInvestigationRepository.insert({
      id: randomUUID(),
      ticketId: state.ticketId,
      ...state.earlyResult,
    });

    if (state.earlyResult.status === 'completed') {
      const store = runtime.store as PostgresStore;
      const namespace = TicketEpisodicMemoryUtil.namespace(this.tenantContext.getTenantId());
      const value = TicketEpisodicMemoryUtil.toValue(state.ticket, state.earlyResult);
      await store.put(namespace, state.ticketId, value, ['text']);
    }

    this.logger.info({ ticketId: state.ticketId, status: investigation.status }, 'Ticket investigation persisted');
    return { investigation };
  }
}
