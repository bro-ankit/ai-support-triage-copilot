import type { UUID } from 'node:crypto';

import { END, START, StateGraph } from '@langchain/langgraph';
import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { Traced } from '../../../tracing/traced.decorator';
import type { InvestigationStage } from '../orchestrator/investigation-progress.types';
import { TICKETS_ERRORS } from '../tickets.constants';
import { type TicketInvestigationGraphState, TicketInvestigationState } from './ticket-investigation.state';
import { TICKET_INVESTIGATION_NODES, type TicketInvestigationNodes } from './ticket-investigation-graph.constants';
import type { TicketInvestigationStreamEvent } from './ticket-investigation-stream-event.types';

type NodeName = keyof TicketInvestigationNodes;

const NODE_STAGES: Record<Exclude<NodeName, 'persist'>, InvestigationStage> = {
  loadContext: 'context_loaded',
  classify: 'classified',
  recall: 'recalled',
  retrieve: 'retrieved',
  diagnose: 'diagnosed',
  propose: 'proposed',
};

@Injectable()
export class TicketInvestigationGraphService {
  private readonly graph;

  constructor(
    @InjectPinoLogger(TicketInvestigationGraphService.name) private readonly logger: PinoLogger,
    @Inject(TICKET_INVESTIGATION_NODES) private readonly nodes: TicketInvestigationNodes,
  ) {
    this.graph = this.buildGraph();
  }

  @Traced<[UUID, AbortSignal?], TicketInvestigationStreamEvent>(
    'ticket_investigation',
    (ticketId) => ({ 'ticket.id': ticketId }),
    (lastEvent) => (lastEvent?.type === 'result' ? { 'investigation.status': lastEvent.investigation.status } : {}),
  )
  async *investigateStream(ticketId: UUID, abortSignal?: AbortSignal): AsyncGenerator<TicketInvestigationStreamEvent> {
    this.logger.info({ ticketId }, 'Starting ticket investigation stream');

    try {
      const stream = await this.graph.stream({ ticketId }, { signal: abortSignal, streamMode: 'updates' });
      for await (const update of stream) {
        for (const [nodeName, partial] of Object.entries(update) as [
          NodeName,
          Partial<TicketInvestigationGraphState>,
        ][]) {
          yield* this.toStreamEvents(nodeName, partial);
        }
      }
      this.logger.info({ ticketId }, 'Ticket investigation stream complete');
    } catch (err) {
      if (abortSignal?.aborted) {
        this.logger.info({ ticketId }, 'Investigation aborted, client disconnected');
        throw new Error(TICKETS_ERRORS.INVESTIGATION_ABORTED);
      }
      throw err;
    }
  }

  private *toStreamEvents(
    nodeName: NodeName,
    partial: Partial<TicketInvestigationGraphState>,
  ): Generator<TicketInvestigationStreamEvent> {
    if (nodeName === 'persist') {
      if (partial.investigation) yield { type: 'result', investigation: partial.investigation };
      return;
    }

    yield { type: 'progress', stage: NODE_STAGES[nodeName], message: this.buildProgressMessage(nodeName, partial) };
  }

  private buildProgressMessage(
    nodeName: Exclude<NodeName, 'persist'>,
    partial: Partial<TicketInvestigationGraphState>,
  ): string {
    switch (nodeName) {
      case 'loadContext':
        return 'Loaded ticket and attachment context';
      case 'classify':
        return 'Classified ticket category and priority';
      case 'recall':
        return `Recalled ${partial.pastCases?.length ?? 0} similar past ticket(s)`;
      case 'retrieve':
        return `Retrieved ${partial.kbChunks?.length ?? 0} knowledge-base chunk(s)`;
      case 'diagnose':
        return partial.diagnosis ? `Diagnosed with ${partial.diagnosis.confidence} confidence` : 'Diagnosis failed';
      case 'propose':
        return partial.earlyResult?.status === 'completed'
          ? `Proposed action: ${partial.earlyResult.proposedAction}`
          : 'Propose-action failed';
    }
  }

  private buildGraph() {
    const { loadContext, classify, recall, retrieve, diagnose, propose, persist } = this.nodes;

    return new StateGraph(TicketInvestigationState)
      .addNode('loadContext', loadContext.run.bind(loadContext))
      .addNode('classify', classify.run.bind(classify))
      .addNode('recall', recall.run.bind(recall))
      .addNode('retrieve', retrieve.run.bind(retrieve))
      .addNode('diagnose', diagnose.run.bind(diagnose))
      .addNode('propose', propose.run.bind(propose))
      .addNode('persist', persist.run.bind(persist))
      .addEdge(START, 'loadContext')
      .addEdge('loadContext', 'classify')
      .addEdge('classify', 'recall')
      .addEdge('recall', 'retrieve')
      .addConditionalEdges('retrieve', (state) => (state.earlyResult ? 'persist' : 'diagnose'), {
        persist: 'persist',
        diagnose: 'diagnose',
      })
      .addConditionalEdges('diagnose', (state) => (state.earlyResult ? 'persist' : 'propose'), {
        persist: 'persist',
        propose: 'propose',
      })
      .addEdge('propose', 'persist')
      .addEdge('persist', END)
      .compile();
  }
}
