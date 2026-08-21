import type { UUID } from 'node:crypto';

import { TicketClassificationRepository } from '../../../../src/app/tickets/repositories/ticket-classification.repository';
import { ticketClassificationsTable } from '../../../../src/schema/ticket-classifications.schema';
import type { TicketClassificationInsert } from '../../../../src/schema/ticket-classifications.schema';
import { ticketsTable } from '../../../../src/schema/tickets.schema';
import { DrizzleTestEnvironment } from '../../../helpers/drizzle-test-environment';
import { mockTicketClassificationInsert, mockTicketInsert } from '../../../__mocks__';

describe('TicketClassificationRepository IT', () => {
  let sut: TicketClassificationRepository;
  const env = new DrizzleTestEnvironment();
  let ticketId: UUID;

  beforeAll(async () => {
    await env.start([TicketClassificationRepository]);
    sut = env.module.get(TicketClassificationRepository);
  }, 60_000);

  afterAll(async () => {
    await env.stop();
  });

  afterEach(async () => {
    await env.db.delete(ticketClassificationsTable);
  });

  beforeEach(async () => {
    const [ticket] = await env.db.insert(ticketsTable).values(mockTicketInsert()).returning();
    ticketId = ticket.id;
  });

  const seed = (overrides: Partial<TicketClassificationInsert> = {}) =>
    sut.insert(mockTicketClassificationInsert({ ticketId, ...overrides }));

  describe('Given insert', () => {
    describe('When called with a valid classification', () => {
      test('Then it persists the classification and returns it with the given id', async () => {
        const data = mockTicketClassificationInsert({ ticketId, category: 'bug', priority: 'low', confidence: 0.4 });

        const result = await sut.insert(data);

        expect(result).toEqual({
          id: data.id,
          ticketId,
          category: 'bug',
          priority: 'low',
          confidence: 0.4,
          createdAt: expect.any(Date),
        });
      });
    });
  });

  describe('Given findByTicketId', () => {
    describe('When the ticket has a classification', () => {
      test('Then it returns that classification', async () => {
        const inserted = await seed();

        const result = await sut.findByTicketId(ticketId);

        expect(result).toEqual(inserted);
      });
    });

    describe('When the ticket has no classification', () => {
      test('Then it returns undefined', async () => {
        const result = await sut.findByTicketId(ticketId);

        expect(result).toBeUndefined();
      });
    });
  });
});
