import { ApproveTicketActionCommandHandler } from './approve-ticket-action.command-handler';
import { CompleteTicketAttachmentUploadCommandHandler } from './complete-ticket-attachment-upload.command-handler';
import { CreateTicketCommandHandler } from './create-ticket.command-handler';
import { ExecuteTicketActionCommandHandler } from './execute-ticket-action.command-handler';
import { InvestigateTicketCommandHandler } from './investigate-ticket.command-handler';
import { RequestTicketAttachmentUploadCommandHandler } from './request-ticket-attachment-upload.command-handler';

export const TICKET_COMMAND_HANDLERS = [
  CreateTicketCommandHandler,
  RequestTicketAttachmentUploadCommandHandler,
  CompleteTicketAttachmentUploadCommandHandler,
  InvestigateTicketCommandHandler,
  ApproveTicketActionCommandHandler,
  ExecuteTicketActionCommandHandler,
];
