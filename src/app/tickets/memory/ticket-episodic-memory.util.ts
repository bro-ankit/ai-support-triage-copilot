import type { UUID } from 'node:crypto';

import type { SearchItem } from '@langchain/langgraph-checkpoint-postgres/store';

import type { TicketProposedAction } from '../../../schema/ticket-investigations.schema';
import type { TicketSelect } from '../../../schema/tickets.schema';
import type { TicketInvestigationResult } from '../ticket-investigation-result.types';
import { TICKET_EPISODIC_MEMORY_DEFAULTS } from './ticket-episodic-memory.constants';
import type { SimilarPastTicketCase } from './ticket-episodic-memory.types';

export type TicketEpisodicMemoryValue = {
  ticketId: UUID;
  subject: string;
  description: string | null;
  diagnosis: string;
  proposedAction: TicketProposedAction | null;
  text: string;
};

export class TicketEpisodicMemoryUtil {
  static namespace(tenantId: UUID): string[] {
    return [TICKET_EPISODIC_MEMORY_DEFAULTS.NAMESPACE_ROOT, tenantId];
  }

  static toSimilarPastCase(item: SearchItem): SimilarPastTicketCase {
    const value = item.value as TicketEpisodicMemoryValue;
    return {
      ticketId: value.ticketId,
      subject: value.subject,
      description: value.description,
      diagnosis: value.diagnosis,
      proposedAction: value.proposedAction,
      distance: 1 - (item.score ?? 0),
    };
  }

  static toValue(ticket: TicketSelect, result: TicketInvestigationResult): TicketEpisodicMemoryValue {
    return {
      ticketId: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      diagnosis: result.diagnosis,
      proposedAction: result.proposedAction ?? null,
      text: [
        `Subject: ${ticket.subject}`,
        `Description: ${ticket.description ?? '(none provided)'}`,
        `Diagnosis: ${result.diagnosis}`,
        `Resolution: ${result.proposedAction ?? '(none)'}`,
      ].join('\n'),
    };
  }
}
