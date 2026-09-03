import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import {
  TICKET_INVESTIGATION_NODES,
  type TicketInvestigationNodes,
} from '../../../../src/app/tickets/graph/ticket-investigation-graph.constants';
import { TicketInvestigationGraphService } from '../../../../src/app/tickets/graph/ticket-investigation-graph.service';
import type { ITicketInvestigationNode } from '../../../../src/app/tickets/graph/ticket-investigation-node.interface';
import type { TicketInvestigationStreamEvent } from '../../../../src/app/tickets/graph/ticket-investigation-stream-event.types';
import { TICKETS_ERRORS } from '../../../../src/app/tickets/tickets.constants';
import {
  mockDiagnoseTicketResponse,
  mockTicketInvestigationResult,
  mockTicketInvestigationSelect,
  mockTicketSelect,
} from '../../../__mocks__';

const TICKET_ID = randomUUID();
const TICKET = mockTicketSelect({ id: TICKET_ID });
const INVESTIGATION = mockTicketInvestigationSelect({ ticketId: TICKET_ID });

const mockNode = (): jest.Mocked<ITicketInvestigationNode> => ({ run: jest.fn() });

const drain = async (
  sut: TicketInvestigationGraphService,
  ticketId: typeof TICKET_ID,
  signal?: AbortSignal,
): Promise<TicketInvestigationStreamEvent[]> => {
  const events: TicketInvestigationStreamEvent[] = [];
  for await (const event of sut.investigateStream(ticketId, signal)) {
    events.push(event);
  }
  return events;
};

describe('TicketInvestigationGraphService Unit Test', () => {
  let sut: TicketInvestigationGraphService;
  let nodes: { [K in keyof TicketInvestigationNodes]: jest.Mocked<ITicketInvestigationNode> };

  beforeAll(() => {
    nodes = {
      loadContext: mockNode(),
      classify: mockNode(),
      recall: mockNode(),
      retrieve: mockNode(),
      diagnose: mockNode(),
      propose: mockNode(),
      persist: mockNode(),
    };

    const { unit } = TestBed.create(TicketInvestigationGraphService)
      .mock(TICKET_INVESTIGATION_NODES)
      .using(nodes)
      .compile();

    sut = unit;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    nodes.loadContext.run.mockResolvedValue({ ticket: TICKET, attachmentText: '' });
    nodes.classify.run.mockResolvedValue({});
    nodes.recall.run.mockResolvedValue({ pastCases: [] });
    nodes.retrieve.run.mockResolvedValue({ kbChunks: [], retrievedChunkIds: [] });
    nodes.diagnose.run.mockResolvedValue({ diagnosis: mockDiagnoseTicketResponse({ confidence: 0.9 }) });
    nodes.propose.run.mockResolvedValue({
      earlyResult: mockTicketInvestigationResult({ status: 'completed', proposedAction: 'refund' }),
    });
    nodes.persist.run.mockResolvedValue({ investigation: INVESTIGATION });
  });

  describe('Given investigateStream', () => {
    describe('When every node runs to completion', () => {
      test('Then it streams a progress event per stage in order, followed by the persisted result', async () => {
        const events = await drain(sut, TICKET_ID);

        expect(events).toEqual([
          { type: 'progress', stage: 'context_loaded', message: 'Loaded ticket and attachment context' },
          { type: 'progress', stage: 'classified', message: 'Classified ticket category and priority' },
          { type: 'progress', stage: 'recalled', message: 'Recalled 0 similar past ticket(s)' },
          { type: 'progress', stage: 'retrieved', message: 'Retrieved 0 knowledge-base chunk(s)' },
          { type: 'progress', stage: 'diagnosed', message: 'Diagnosed with 0.9 confidence' },
          { type: 'progress', stage: 'proposed', message: 'Proposed action: refund' },
          { type: 'result', investigation: INVESTIGATION },
        ]);
        expect(nodes.diagnose.run).toHaveBeenCalled();
        expect(nodes.propose.run).toHaveBeenCalled();
      });
    });

    describe('When retrieve sets an early result (no KB findings)', () => {
      test('Then it streams up through retrieved and the result, skipping diagnose and propose', async () => {
        nodes.retrieve.run.mockResolvedValue({
          kbChunks: [],
          earlyResult: mockTicketInvestigationResult({ status: 'needs_review' }),
        });

        const events = await drain(sut, TICKET_ID);

        expect(events).toEqual([
          { type: 'progress', stage: 'context_loaded', message: 'Loaded ticket and attachment context' },
          { type: 'progress', stage: 'classified', message: 'Classified ticket category and priority' },
          { type: 'progress', stage: 'recalled', message: 'Recalled 0 similar past ticket(s)' },
          { type: 'progress', stage: 'retrieved', message: 'Retrieved 0 knowledge-base chunk(s)' },
          { type: 'result', investigation: INVESTIGATION },
        ]);
        expect(nodes.diagnose.run).not.toHaveBeenCalled();
        expect(nodes.propose.run).not.toHaveBeenCalled();
      });
    });

    describe('When diagnose sets an early result (failed or low confidence)', () => {
      test('Then it streams up through diagnosed and the result, skipping propose', async () => {
        nodes.diagnose.run.mockResolvedValue({ earlyResult: mockTicketInvestigationResult({ status: 'failed' }) });

        const events = await drain(sut, TICKET_ID);

        expect(events).toEqual([
          { type: 'progress', stage: 'context_loaded', message: 'Loaded ticket and attachment context' },
          { type: 'progress', stage: 'classified', message: 'Classified ticket category and priority' },
          { type: 'progress', stage: 'recalled', message: 'Recalled 0 similar past ticket(s)' },
          { type: 'progress', stage: 'retrieved', message: 'Retrieved 0 knowledge-base chunk(s)' },
          { type: 'progress', stage: 'diagnosed', message: 'Diagnosis failed' },
          { type: 'result', investigation: INVESTIGATION },
        ]);
        expect(nodes.propose.run).not.toHaveBeenCalled();
      });
    });

    describe('When the abort signal is already aborted before the graph starts', () => {
      test('Then it throws the investigation-aborted error without running any node', async () => {
        const abortController = new AbortController();
        abortController.abort();

        await expect(drain(sut, TICKET_ID, abortController.signal)).rejects.toThrow(
          TICKETS_ERRORS.INVESTIGATION_ABORTED,
        );
        expect(nodes.loadContext.run).not.toHaveBeenCalled();
      });
    });

    describe('When the abort signal is aborted mid-flight, during classify', () => {
      test('Then it stops the stream and throws the investigation-aborted error without running recall', async () => {
        const abortController = new AbortController();
        nodes.classify.run.mockImplementation(async () => {
          abortController.abort();
          return {};
        });

        await expect(drain(sut, TICKET_ID, abortController.signal)).rejects.toThrow(
          TICKETS_ERRORS.INVESTIGATION_ABORTED,
        );
        expect(nodes.recall.run).not.toHaveBeenCalled();
      });
    });
  });
});
