import type { TicketSelect } from '../../../schema/tickets.schema';
import type { ClassifyTicketResponse } from './ticket-classification.contract';

export interface ITicketClassifier {
  readonly name: string;
  classify(ticket: TicketSelect, attachmentText: string): Promise<ClassifyTicketResponse | null>;
}
