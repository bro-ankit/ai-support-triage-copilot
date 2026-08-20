import { randomUUID } from 'node:crypto';

export class TicketAttachmentKeyUtil {
  static build(ticketId: string, filename: string): string {
    return `tickets/${ticketId}/${randomUUID()}-${filename}`;
  }
}
