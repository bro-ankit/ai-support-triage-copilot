import type { UUID } from 'node:crypto';

import { EMBEDDING_DIMENSIONS } from '../../../../src/ai/gemini/gemini.constants';
import { TicketInvestigationRepository } from '../../../../src/app/tickets/repositories/ticket-investigation.repository';
import { ticketInvestigationsTable } from '../../../../src/schema/ticket-investigations.schema';
import type { TicketInvestigationInsert } from '../../../../src/schema/ticket-investigations.schema';
import { ticketsTable } from '../../../../src/schema/tickets.schema';
import { DrizzleTestEnvironment } from '../../../helpers/drizzle-test-environment';
import { MOCK_TENANT_ID, mockTicketInsert, mockTicketInvestigationInsert } from '../../../__mocks__';

const embeddingOf = (fillValue: number): number[] => new Array(EMBEDDING_DIMENSIONS).fill(fillValue);

const orthogonalEmbedding = (): number[] =>
  Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i % 2 === 0 ? 0.1 : -0.1));

describe('TicketInvestigationRepository IT', () => {
  let sut: TicketInvestigationRepository;
  const env = new DrizzleTestEnvironment();
  let ticketId: UUID;

  beforeAll(async () => {
    await env.start([TicketInvestigationRepository]);
    sut = env.module.get(TicketInvestigationRepository);
  }, 60_000);

  afterAll(async () => {
    await env.stop();
  });

  afterEach(async () => {
    await env.db.delete(ticketInvestigationsTable);
  });

  beforeEach(async () => {
    const [ticket] = await env.db.insert(ticketsTable).values(mockTicketInsert()).returning();
    ticketId = ticket.id;
  });

  const withTenant = <T>(fn: () => Promise<T>) => env.withTenant(MOCK_TENANT_ID, fn);

  const seed = (overrides: Partial<TicketInvestigationInsert> = {}) =>
    withTenant(() => sut.insert(mockTicketInvestigationInsert({ ticketId, ...overrides })));

  describe('Given insert', () => {
    describe('When called with a valid investigation', () => {
      test('Then it persists the investigation and returns it with the given id', async () => {
        const data = mockTicketInvestigationInsert({
          ticketId,
          status: 'needs_review',
          proposedAction: null,
          proposedActionReasoning: null,
        });

        const result = await withTenant(() => sut.insert(data));

        expect(result).toEqual({
          id: data.id,
          tenantId: MOCK_TENANT_ID,
          ticketId,
          retrievedChunkIds: data.retrievedChunkIds,
          diagnosis: data.diagnosis,
          diagnosisConfidence: data.diagnosisConfidence,
          proposedAction: null,
          proposedActionReasoning: null,
          status: 'needs_review',
          episodeEmbedding: null,
          createdAt: expect.any(Date),
        });
      });
    });
  });

  describe('Given findByTicketId', () => {
    describe('When the ticket has an investigation', () => {
      test('Then it returns that investigation', async () => {
        const inserted = await seed();

        const result = await sut.findByTicketId(ticketId);

        expect(result).toEqual(inserted);
      });
    });

    describe('When the ticket has no investigation', () => {
      test('Then it returns undefined', async () => {
        const result = await sut.findByTicketId(ticketId);

        expect(result).toBeUndefined();
      });
    });
  });

  describe('Given findSimilarCases', () => {
    describe('When a similar completed investigation exists within maxDistance, excluding the given ticket itself', () => {
      test('Then it returns that case with the parent ticket subject/description, nearest first', async () => {
        const [otherTicket] = await env.db.insert(ticketsTable).values(mockTicketInsert()).returning();
        const near = await seed({
          ticketId: otherTicket.id,
          diagnosis: 'Duplicate webhook delivery caused a double charge.',
          episodeEmbedding: embeddingOf(0.1),
        });
        await seed({ episodeEmbedding: orthogonalEmbedding() });

        const results = await withTenant(() => sut.findSimilarCases(embeddingOf(0.1), ticketId, 10, 0.01));

        expect(results).toEqual([
          {
            ticketId: otherTicket.id,
            subject: otherTicket.subject,
            description: otherTicket.description,
            diagnosis: near.diagnosis,
            proposedAction: near.proposedAction,
            distance: expect.any(Number),
          },
        ]);
      });
    });

    describe('When the only similar investigation belongs to the excluded ticket', () => {
      test('Then it is excluded from the results', async () => {
        await seed({ episodeEmbedding: embeddingOf(0.1) });

        const results = await withTenant(() => sut.findSimilarCases(embeddingOf(0.1), ticketId, 10, 0.01));

        expect(results).toEqual([]);
      });
    });

    describe('When no investigation has an embedding', () => {
      test('Then it returns an empty array', async () => {
        const [otherTicket] = await env.db.insert(ticketsTable).values(mockTicketInsert()).returning();
        await seed({ ticketId: otherTicket.id, episodeEmbedding: null });

        const results = await withTenant(() => sut.findSimilarCases(embeddingOf(0.1), ticketId, 10, 0.5));

        expect(results).toEqual([]);
      });
    });
  });
});
