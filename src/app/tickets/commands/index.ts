import { CompleteTicketAttachmentUploadCommandHandler } from './complete-ticket-attachment-upload.command-handler';
import { CreateTicketCommandHandler } from './create-ticket.command-handler';
import { RequestTicketAttachmentUploadCommandHandler } from './request-ticket-attachment-upload.command-handler';

export const TICKET_COMMAND_HANDLERS = [
  CreateTicketCommandHandler,
  RequestTicketAttachmentUploadCommandHandler,
  CompleteTicketAttachmentUploadCommandHandler,
];
