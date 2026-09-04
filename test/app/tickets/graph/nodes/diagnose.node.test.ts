import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { DiagnoseTicketAgent } from '../../../../../src/app/tickets/agents/diagnose-ticket.agent';
import { DiagnoseNode } from '../../../../../src/app/tickets/graph/nodes/diagnose.node';
import { TicketInvestigationResultUtil } from '../../../../../src/app/tickets/graph/ticket-investigation-result.util';
import {
  mockDiagnoseTicketResponse,
  mockKbChunkSelect,
  mockSimilarPastCase,
  mockTicketInvestigationGraphState,
  mockTicketSelect,
} from '../../../../__mocks__';

const TICKET_ID = randomUUID();
const TICKET = mockTicketSelect({ id: TICKET_ID });
const CHUNK = mockKbChunkSelect();
const RETRIEVED_CHUNK_IDS = [CHUNK.id];
const STATE = mockTicketInvestigationGraphState({
  ticketId: TICKET_ID,
  ticket: TICKET,
  kbChunks: [CHUNK],
  retrievedChunkIds: RETRIEVED_CHUNK_IDS,
  pastCases: [],
});

describe('DiagnoseNode Unit Test', () => {
  let sut: DiagnoseNode;
  let diagnoseTicketAgent: jest.Mocked<DiagnoseTicketAgent>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(DiagnoseNode).compile();

    sut = unit;
    diagnoseTicketAgent = unitRef.get(DiagnoseTicketAgent);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given run', () => {
    describe('When diagnosis succeeds and clears the confidence threshold', () => {
      test('Then it diagnoses using the labeled KB findings and formatted past cases, and returns the diagnosis and cited chunk ids without an early result', async () => {
        const pastCase = mockSimilarPastCase();
        const diagnosis = mockDiagnoseTicketResponse({
          confidence: 0.9,
          diagnosis: 'Duplicate webhook delivery caused a double charge. [[KB1]]',
        });
        diagnoseTicketAgent.diagnose.mockResolvedValue(diagnosis);

        const result = await sut.run(mockTicketInvestigationGraphState({ ...STATE, pastCases: [pastCase] }));

        expect(diagnoseTicketAgent.diagnose).toHaveBeenCalledWith(
          TICKET,
          `[[KB1]] ${CHUNK.content}`,
          `Past ticket: ${pastCase.subject}\nDescription: ${pastCase.description}\n` +
            `Diagnosis: ${pastCase.diagnosis}\nResolution: ${pastCase.proposedAction}`,
        );
        expect(result).toEqual({ diagnosis, citedChunkIds: [CHUNK.id] });
      });
    });

    describe('When diagnosis confidence is below the threshold', () => {
      test('Then it returns an early needs_review result and keeps the diagnosis', async () => {
        const diagnosis = mockDiagnoseTicketResponse({ confidence: 0.2 });
        diagnoseTicketAgent.diagnose.mockResolvedValue(diagnosis);

        const result = await sut.run(STATE);

        expect(result).toEqual({
          diagnosis,
          citedChunkIds: [],
          earlyResult: TicketInvestigationResultUtil.needsReviewResult(RETRIEVED_CHUNK_IDS, diagnosis, []),
        });
      });
    });

    describe('When diagnosis succeeds, clears the confidence threshold, but cites no retrieved KB chunk', () => {
      test('Then it returns an early needs_review result with empty cited chunk ids', async () => {
        const diagnosis = mockDiagnoseTicketResponse({ confidence: 0.9 });
        diagnoseTicketAgent.diagnose.mockResolvedValue(diagnosis);

        const result = await sut.run(STATE);

        expect(result).toEqual({
          diagnosis,
          citedChunkIds: [],
          earlyResult: TicketInvestigationResultUtil.needsReviewResult(RETRIEVED_CHUNK_IDS, diagnosis, []),
        });
      });
    });

    describe('When diagnosis fails', () => {
      test('Then it returns an early failed result', async () => {
        diagnoseTicketAgent.diagnose.mockRejectedValue(new Error('Gemini timed out'));

        const result = await sut.run(STATE);

        expect(result).toEqual({
          earlyResult: TicketInvestigationResultUtil.diagnosisFailedResult(RETRIEVED_CHUNK_IDS),
        });
      });
    });
  });
});
