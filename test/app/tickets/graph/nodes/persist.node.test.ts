import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';
import type { Runtime } from '@langchain/langgraph';

import { PersistNode } from '../../../../../src/app/tickets/graph/nodes/persist.node';
import { TICKET_EPISODIC_MEMORY_DEFAULTS } from '../../../../../src/app/tickets/memory/ticket-episodic-memory.constants';
import { TicketInvestigationRepository } from '../../../../../src/app/tickets/repositories/ticket-investigation.repository';
import { TenantContextService } from '../../../../../src/auth/tenant-context.service';
import {
  mockTicketInvestigationGraphState,
  mockTicketInvestigationResult,
  mockTicketInvestigationSelect,
  mockTicketSelect,
} from '../../../../__mocks__';
import { AssertUtils } from '../../../../utils/assert.utils';

const TICKET_ID = randomUUID();
const TENANT_ID = randomUUID();
const TICKET = mockTicketSelect({ id: TICKET_ID });
const NAMESPACE = [TICKET_EPISODIC_MEMORY_DEFAULTS.NAMESPACE_ROOT, TENANT_ID];

describe('PersistNode Unit Test', () => {
  let sut: PersistNode;
  let tenantContext: jest.Mocked<TenantContextService>;
  let ticketInvestigationRepository: jest.Mocked<TicketInvestigationRepository>;
  let store: { put: jest.Mock };
  let runtime: Runtime;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(PersistNode).compile();

    sut = unit;
    tenantContext = unitRef.get(TenantContextService);
    ticketInvestigationRepository = unitRef.get(TicketInvestigationRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tenantContext.getTenantId.mockReturnValue(TENANT_ID);
    store = { put: jest.fn() };
    runtime = { store } as unknown as Runtime;
  });

  describe('Given run', () => {
    describe('When called with a completed early result', () => {
      test('Then it persists the investigation and stores the episode in the tenant-scoped namespace', async () => {
        const earlyResult = mockTicketInvestigationResult({
          status: 'completed',
          diagnosis: 'Duplicate webhook delivery caused a double charge.',
          proposedAction: 'refund',
        });
        const state = mockTicketInvestigationGraphState({ ticketId: TICKET_ID, ticket: TICKET, earlyResult });
        const investigation = mockTicketInvestigationSelect({ ticketId: TICKET_ID });
        ticketInvestigationRepository.insert.mockResolvedValue(investigation);

        const result = await sut.run(state, runtime);

        expect(ticketInvestigationRepository.insert).toHaveBeenCalledWith({
          id: expect.any(String),
          ticketId: TICKET_ID,
          ...earlyResult,
        });
        expect(store.put).toHaveBeenCalledWith(
          NAMESPACE,
          TICKET_ID,
          {
            ticketId: TICKET_ID,
            subject: TICKET.subject,
            description: TICKET.description,
            diagnosis: earlyResult.diagnosis,
            proposedAction: earlyResult.proposedAction,
            text:
              `Subject: ${TICKET.subject}\nDescription: ${TICKET.description}\n` +
              `Diagnosis: ${earlyResult.diagnosis}\nResolution: ${earlyResult.proposedAction}`,
          },
          ['text'],
        );
        expect(result).toEqual({ investigation });
      });
    });

    describe('When called with a non-completed early result', () => {
      test('Then it persists the investigation without storing an episode', async () => {
        const earlyResult = mockTicketInvestigationResult({ status: 'needs_review' });
        const state = mockTicketInvestigationGraphState({ ticketId: TICKET_ID, ticket: TICKET, earlyResult });
        const investigation = mockTicketInvestigationSelect({ ticketId: TICKET_ID });
        ticketInvestigationRepository.insert.mockResolvedValue(investigation);

        const result = await sut.run(state, runtime);

        expect(store.put).not.toHaveBeenCalled();
        expect(result).toEqual({ investigation });
      });
    });

    describe('When called without an early result', () => {
      test('Then it throws without persisting or storing anything', async () => {
        const state = mockTicketInvestigationGraphState({
          ticketId: TICKET_ID,
          ticket: TICKET,
          earlyResult: undefined,
        });

        await AssertUtils.assertError(
          () => sut.run(state, runtime),
          `Ticket investigation graph reached persist for ${TICKET_ID} without a result`,
        );
        expect(ticketInvestigationRepository.insert).not.toHaveBeenCalled();
        expect(store.put).not.toHaveBeenCalled();
      });
    });
  });
});
