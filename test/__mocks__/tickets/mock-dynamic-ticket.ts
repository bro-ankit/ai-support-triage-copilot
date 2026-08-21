import type { DynamicTicket } from '../../../src/app/tickets/ticket.types';
import { mockTicketSelect } from './mock-ticket.select';

export const mockDynamicTicket = <R extends { attachments?: boolean }>(
  relations: R,
  args: Partial<DynamicTicket<R>> = {},
): DynamicTicket<R> => {
  const base = mockTicketSelect();
  const withRelations = relations.attachments ? { ...base, attachments: [] } : base;
  return { ...withRelations, ...args } as DynamicTicket<R>;
};
