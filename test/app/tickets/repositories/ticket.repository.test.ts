import { randomUUID } from 'node:crypto';

import { TicketRepository } from '../../../../src/app/tickets/repositories/ticket.repository';
import { ticketsTable } from '../../../../src/schema/tickets.schema';
import type { TicketInsert } from '../../../../src/schema/tickets.schema';
import { DrizzleTestEnvironment } from '../../../helpers/drizzle-test-environment';
import { mockTicketInsert } from '../../../__mocks__';

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
    describe('When the ticket exists', () => {
      test('Then it returns that ticket', async () => {
        const inserted = await seed({ subject: 'Search returns no results' });

        const result = await sut.findById(inserted.id);

        expect(result).toEqual(inserted);
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
