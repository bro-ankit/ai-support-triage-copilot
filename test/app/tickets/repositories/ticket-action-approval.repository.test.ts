import { randomUUID, type UUID } from 'node:crypto';

import { TicketActionApprovalRepository } from '../../../../src/app/tickets/repositories/ticket-action-approval.repository';
import { ticketActionApprovalsTable } from '../../../../src/schema/ticket-action-approvals.schema';
import { ticketInvestigationsTable } from '../../../../src/schema/ticket-investigations.schema';
import { ticketsTable } from '../../../../src/schema/tickets.schema';
import { DrizzleTestEnvironment } from '../../../helpers/drizzle-test-environment';
import { mockTicketInsert, mockTicketInvestigationInsert } from '../../../__mocks__';

describe('TicketActionApprovalRepository IT', () => {
  let sut: TicketActionApprovalRepository;
  const env = new DrizzleTestEnvironment();
  let investigationId: UUID;

  beforeAll(async () => {
    await env.start([TicketActionApprovalRepository]);
    sut = env.module.get(TicketActionApprovalRepository);
  }, 60_000);

  afterAll(async () => {
    await env.stop();
  });

  afterEach(async () => {
    await env.db.delete(ticketActionApprovalsTable);
    await env.db.delete(ticketInvestigationsTable);
    await env.db.delete(ticketsTable);
  });

  beforeEach(async () => {
    const [ticket] = await env.db.insert(ticketsTable).values(mockTicketInsert()).returning();
    const [investigation] = await env.db
      .insert(ticketInvestigationsTable)
      .values(mockTicketInvestigationInsert({ ticketId: ticket.id }))
      .returning();
    investigationId = investigation.id;
  });

  const seedApproval = (overrides: Partial<{ expiresAt: Date; consumedAt: Date | null }> = {}) =>
    sut.insert({
      id: randomUUID(),
      ticketInvestigationId: investigationId,
      action: 'refund',
      approvedBy: 'approver-client-id',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 15 * 60_000),
      ...(overrides.consumedAt !== undefined && { consumedAt: overrides.consumedAt }),
    });

  describe('Given findLatestByInvestigationId', () => {
    describe('When multiple approvals exist for the investigation', () => {
      test('Then it returns the most recently approved one', async () => {
        await seedApproval();
        await new Promise((resolve) => setTimeout(resolve, 10));
        const latest = await seedApproval();

        const result = await sut.findLatestByInvestigationId(investigationId);

        expect(result?.id).toBe(latest.id);
      });
    });

    describe('When no approval exists', () => {
      test('Then it returns undefined', async () => {
        const result = await sut.findLatestByInvestigationId(investigationId);

        expect(result).toBeUndefined();
      });
    });
  });

  describe('Given consumeIfActive', () => {
    describe('When the approval is unconsumed and unexpired', () => {
      test('Then it marks it consumed and returns the updated row', async () => {
        const approval = await seedApproval();

        const result = await sut.consumeIfActive(approval.id);

        expect(result?.consumedAt).toBeInstanceOf(Date);
      });
    });

    describe('When the approval was already consumed', () => {
      test('Then it returns undefined and does not touch consumedAt again', async () => {
        const approval = await seedApproval();
        const firstConsume = await sut.consumeIfActive(approval.id);

        const secondConsume = await sut.consumeIfActive(approval.id);

        expect(secondConsume).toBeUndefined();
        const stillLatest = await sut.findLatestByInvestigationId(investigationId);
        expect(stillLatest?.consumedAt).toEqual(firstConsume?.consumedAt);
      });
    });

    describe('When the approval has expired', () => {
      test('Then it returns undefined', async () => {
        const approval = await seedApproval({ expiresAt: new Date(Date.now() - 1000) });

        const result = await sut.consumeIfActive(approval.id);

        expect(result).toBeUndefined();
      });
    });

    describe('When two callers race to consume the same approval concurrently', () => {
      test('Then exactly one consume succeeds and the other is refused, proving the atomic compare-and-swap holds under real concurrency', async () => {
        const approval = await seedApproval();

        const [first, second] = await Promise.all([
          sut.consumeIfActive(approval.id),
          sut.consumeIfActive(approval.id),
        ]);

        const results = [first, second];
        const succeeded = results.filter((r) => r !== undefined);
        const refused = results.filter((r) => r === undefined);

        expect(succeeded).toHaveLength(1);
        expect(refused).toHaveLength(1);
      });
    });
  });
});
