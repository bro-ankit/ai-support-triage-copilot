import { PromptBoundaryUtil } from '../../../ai/prompt-boundary.util';
import type { TicketSelect } from '../../../schema/tickets.schema';

export class ClassifyTicketPromptUtil {
  static buildUserContent(ticket: TicketSelect, attachmentText: string): string {
    return PromptBoundaryUtil.wrap(
      'untrusted_ticket_content',
      `Subject: ${ticket.subject}\n` +
        `Description: ${ticket.description ?? '(none provided)'}\n` +
        `Attachment text: ${attachmentText || '(none)'}`,
    );
  }
}
