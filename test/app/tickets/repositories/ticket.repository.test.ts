import { randomUUID } from 'node:crypto';

import { TicketRepository } from '../../../../src/app/tickets/repositories/ticket.repository';
import { ticketAttachmentsTable } from '../../../../src/schema/ticket-attachments.schema';
import { ticketsTable } from '../../../../src/schema/tickets.schema';
import type { TicketInsert } from '../../../../src/schema/tickets.schema';
import { DrizzleTestEnvironment } from '../../../helpers/drizzle-test-environment';
import { mockTicketAttachmentInsert, mockTicketInsert } from '../../../__mocks__';

describe('TicketRepository IT', () => {
  let sut: TicketRepository;
  const env = new DrizzleTestEnvironment();

  beforeAll(async () => {
    await env.start([TicketRepository]);
    sut = env.module.get(TicketRepository);
  }, 60_000);

  afterAll(async () => {
    await env.stop();
  });

  afterEach(async () => {
    await env.db.delete(ticketsTable);
  });

  const seed = (overrides: Partial<TicketInsert> = {}) => sut.insert(mockTicketInsert(overrides));

  describe('Given insert', () => {
    describe('When called with a valid ticket', () => {
      test('Then it persists the ticket and returns it with the given id, defaulted status, and generated timestamps', async () => {
        const data = mockTicketInsert({ subject: 'Voice note upload never completes' });

        const result = await sut.insert(data);

        expect(result).toEqual({
          id: data.id,
          subject: data.subject,
          description: data.description,
          status: 'open',
          priority: data.priority,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });
  });

  describe('Given findById', () => {
    describe('When called without relations', () => {
      test('Then it returns the ticket without an attachments field', async () => {
        const ticket = await seed({ subject: 'Search returns no results' });

        const result = await sut.findById(ticket.id);

        expect(result).toEqual(ticket);
      });
    });

    describe('When called with { attachments: true } and the ticket has attachments', () => {
      test('Then it returns the ticket with its attachments joined', async () => {
        const ticket = await seed({ subject: 'Screenshot attached' });
        const [attachment] = await env.db
          .insert(ticketAttachmentsTable)
          .values(mockTicketAttachmentInsert({ ticketId: ticket.id }))
          .returning();

        const result = await sut.findById(ticket.id, { attachments: true });

        expect(result).toEqual({ ...ticket, attachments: [attachment] });
      });
    });

    describe('When called with { attachments: true } and the ticket has no attachments', () => {
      test('Then it returns the ticket with an empty attachments array', async () => {
        const ticket = await seed({ subject: 'No attachments' });

        const result = await sut.findById(ticket.id, { attachments: true });

        expect(result).toEqual({ ...ticket, attachments: [] });
      });
    });

    describe('When the ticket does not exist', () => {
      test('Then it returns undefined', async () => {
        const result = await sut.findById(randomUUID());

        expect(result).toBeUndefined();
      });
    });
  });
});
