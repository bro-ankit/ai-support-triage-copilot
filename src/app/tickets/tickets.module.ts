import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { OllamaModule } from '../../ai/ollama/ollama.module';
import { KbModule } from '../kb/kb.module';
import { DiagnoseTicketAgent } from './agents/diagnose-ticket.agent';
import { ProposeTicketActionAgent } from './agents/propose-ticket-action.agent';
import { GeminiTicketClassifier } from './classification/gemini-ticket-classifier';
import { OllamaTicketClassifier } from './classification/ollama-ticket-classifier';
import { TicketClassifierAgent } from './classification/ticket-classifier.agent';
import { TICKET_CLASSIFIER_CHAIN } from './classification/ticket-classifier.constants';
import type { ITicketClassifier } from './classification/ticket-classifier.interface';
import { TICKET_COMMAND_HANDLERS } from './commands';
import { ClassifyNode } from './graph/nodes/classify.node';
import { DiagnoseNode } from './graph/nodes/diagnose.node';
import { LoadContextNode } from './graph/nodes/load-context.node';
import { PersistNode } from './graph/nodes/persist.node';
import { ProposeNode } from './graph/nodes/propose.node';
import { RecallNode } from './graph/nodes/recall.node';
import { RetrieveNode } from './graph/nodes/retrieve.node';
import {
  TICKET_INVESTIGATION_NODES,
  type TicketInvestigationNodes,
} from './graph/ticket-investigation-graph.constants';
import { TicketInvestigationGraphService } from './graph/ticket-investigation-graph.service';
import { EpisodicMemoryService } from './memory/episodic-memory.service';
import { TicketClassificationStepService } from './orchestrator/steps/ticket-classification-step.service';
import { TicketInvestigationContextService } from './orchestrator/ticket-investigation-context.service';
import { TICKET_QUERY_HANDLERS } from './queries';
import { TicketRepository } from './repositories/ticket.repository';
import { TicketActionApprovalRepository } from './repositories/ticket-action-approval.repository';
import { TicketAttachmentRepository } from './repositories/ticket-attachment.repository';
import { TicketClassificationRepository } from './repositories/ticket-classification.repository';
import { TicketInvestigationRepository } from './repositories/ticket-investigation.repository';
import { TicketsController } from './tickets.controller';

@Module({
  imports: [CqrsModule, KbModule, OllamaModule],
  providers: [
    TicketRepository,
    TicketAttachmentRepository,
    TicketClassificationRepository,
    TicketInvestigationRepository,
    TicketActionApprovalRepository,
    OllamaTicketClassifier,
    GeminiTicketClassifier,
    TicketClassifierAgent,
    {
      provide: TICKET_CLASSIFIER_CHAIN,
      useFactory: (ollama: OllamaTicketClassifier, gemini: GeminiTicketClassifier): ITicketClassifier[] => [
        ollama,
        gemini,
      ],
      inject: [OllamaTicketClassifier, GeminiTicketClassifier],
    },
    DiagnoseTicketAgent,
    ProposeTicketActionAgent,
    EpisodicMemoryService,
    TicketInvestigationContextService,
    TicketClassificationStepService,
    LoadContextNode,
    ClassifyNode,
    RecallNode,
    RetrieveNode,
    DiagnoseNode,
    ProposeNode,
    PersistNode,
    {
      provide: TICKET_INVESTIGATION_NODES,
      useFactory: (
        loadContext: LoadContextNode,
        classify: ClassifyNode,
        recall: RecallNode,
        retrieve: RetrieveNode,
        diagnose: DiagnoseNode,
        propose: ProposeNode,
        persist: PersistNode,
      ): TicketInvestigationNodes => ({ loadContext, classify, recall, retrieve, diagnose, propose, persist }),
      inject: [LoadContextNode, ClassifyNode, RecallNode, RetrieveNode, DiagnoseNode, ProposeNode, PersistNode],
    },
    TicketInvestigationGraphService,
    ...TICKET_COMMAND_HANDLERS,
    ...TICKET_QUERY_HANDLERS,
  ],
  controllers: [TicketsController],
})
export class TicketsModule {}
