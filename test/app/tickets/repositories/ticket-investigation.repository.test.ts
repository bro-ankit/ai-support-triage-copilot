import type { UUID } from 'node:crypto';

import { TicketInvestigationRepository } from '../../../../src/app/tickets/repositories/ticket-investigation.repository';
import type { TicketInvestigationInsert } from '../../../../src/schema/ticket-investigations.schema';
import { ticketInvestigationsTable } from '../../../../src/schema/ticket-investigations.schema';
import { ticketsTable } from '../../../../src/schema/tickets.schema';
import { MOCK_TENANT_ID, mockTicketInsert, mockTicketInvestigationInsert } from '../../../__mocks__';
import { DrizzleTestEnvironment } from '../../../helpers/drizzle-test-environment';

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
});
