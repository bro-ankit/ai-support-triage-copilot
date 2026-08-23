import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { KbModule } from '../kb/kb.module';
import { ClassifyTicketAgent } from './agents/classify-ticket.agent';
import { DiagnoseTicketAgent } from './agents/diagnose-ticket.agent';
import { ProposeTicketActionAgent } from './agents/propose-ticket-action.agent';
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
  imports: [CqrsModule, KbModule],
  providers: [
    TicketRepository,
    TicketAttachmentRepository,
    TicketClassificationRepository,
    TicketInvestigationRepository,
    TicketActionApprovalRepository,
    ClassifyTicketAgent,
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
