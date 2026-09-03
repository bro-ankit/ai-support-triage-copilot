import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';
import type { Runtime } from '@langchain/langgraph';

import { RecallNode } from '../../../../../src/app/tickets/graph/nodes/recall.node';
import { TICKET_EPISODIC_MEMORY_DEFAULTS } from '../../../../../src/app/tickets/memory/ticket-episodic-memory.constants';
import { TenantContextService } from '../../../../../src/auth/tenant-context.service';
import { mockTicketInvestigationGraphState } from '../../../../__mocks__';

const TICKET_ID = randomUUID();
const TENANT_ID = randomUUID();
const SEARCH_QUERY = 'Charged twice for order #4821';
const STATE = mockTicketInvestigationGraphState({ ticketId: TICKET_ID, searchQuery: SEARCH_QUERY });
const NAMESPACE = [TICKET_EPISODIC_MEMORY_DEFAULTS.NAMESPACE_ROOT, TENANT_ID];

describe('RecallNode Unit Test', () => {
  let sut: RecallNode;
  let tenantContext: jest.Mocked<TenantContextService>;
  let store: { search: jest.Mock };
  let runtime: Runtime;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RecallNode).compile();

    sut = unit;
    tenantContext = unitRef.get(TenantContextService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tenantContext.getTenantId.mockReturnValue(TENANT_ID);
    store = { search: jest.fn() };
    runtime = { store } as unknown as Runtime;
  });

  describe('Given run', () => {
    describe('When similar past cases are found', () => {
      test('Then it searches the tenant-scoped namespace by vector similarity, excluding the given ticket, and returns the mapped cases', async () => {
        const otherTicketId = randomUUID();
        store.search.mockResolvedValue([
          {
            namespace: NAMESPACE,
            key: otherTicketId,
            value: {
              ticketId: otherTicketId,
              subject: 'Charged twice for order #1234',
              description: 'Please refund the duplicate charge.',
              diagnosis: 'Duplicate webhook delivery caused a double charge.',
              proposedAction: 'refund',
              text: 'irrelevant for this test',
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            score: 0.9,
          },
        ]);

        const result = await sut.run(STATE, runtime);

        expect(store.search).toHaveBeenCalledWith(NAMESPACE, {
          query: SEARCH_QUERY,
          mode: 'vector',
          limit: TICKET_EPISODIC_MEMORY_DEFAULTS.CANDIDATE_K,
          similarityThreshold: TICKET_EPISODIC_MEMORY_DEFAULTS.SIMILARITY_THRESHOLD,
          filter: { ticketId: { $ne: TICKET_ID } },
        });
        expect(result).toEqual({
          pastCases: [
            {
              ticketId: otherTicketId,
              subject: 'Charged twice for order #1234',
              description: 'Please refund the duplicate charge.',
              diagnosis: 'Duplicate webhook delivery caused a double charge.',
              proposedAction: 'refund',
              distance: 1 - 0.9,
            },
          ],
        });
      });
    });

    describe('When no similar past cases are found', () => {
      test('Then it returns an empty past cases array', async () => {
        store.search.mockResolvedValue([]);

        const result = await sut.run(STATE, runtime);

        expect(result).toEqual({ pastCases: [] });
      });
    });
  });
});
