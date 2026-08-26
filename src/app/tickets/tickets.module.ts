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
import { TicketClassificationStepService } from './orchestrator/steps/ticket-classification-step.service';
import { TicketDiagnosisStepService } from './orchestrator/steps/ticket-diagnosis-step.service';
import { TicketInvestigationContextService } from './orchestrator/ticket-investigation-context.service';
import { TicketInvestigationOrchestratorService } from './orchestrator/ticket-investigation-orchestrator.service';
import { TICKET_QUERY_HANDLERS } from './queries';
import { TicketActionApprovalRepository } from './repositories/ticket-action-approval.repository';
import { TicketAttachmentRepository } from './repositories/ticket-attachment.repository';
import { TicketClassificationRepository } from './repositories/ticket-classification.repository';
import { TicketInvestigationRepository } from './repositories/ticket-investigation.repository';
import { TicketRepository } from './repositories/ticket.repository';
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
      useFactory: (ollama: OllamaTicketClassifier, gemini: GeminiTicketClassifier): ITicketClassifier[] => [ollama, gemini],
      inject: [OllamaTicketClassifier, GeminiTicketClassifier],
    },
    DiagnoseTicketAgent,
    ProposeTicketActionAgent,
    TicketInvestigationContextService,
    TicketClassificationStepService,
    TicketDiagnosisStepService,
    TicketInvestigationOrchestratorService,
    ...TICKET_COMMAND_HANDLERS,
    ...TICKET_QUERY_HANDLERS,
  ],
  controllers: [TicketsController],
})
export class TicketsModule { }
