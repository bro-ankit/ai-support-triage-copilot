import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { ProposeTicketActionAgent } from '../../../../../src/app/tickets/agents/propose-ticket-action.agent';
import { ProposeNode } from '../../../../../src/app/tickets/graph/nodes/propose.node';
import { TicketInvestigationResultUtil } from '../../../../../src/app/tickets/graph/ticket-investigation-result.util';
import {
  mockDiagnoseTicketResponse,
  mockProposeTicketActionResponse,
  mockTicketInvestigationGraphState,
  mockTicketSelect,
} from '../../../../__mocks__';
import { AssertUtils } from '../../../../utils/assert.utils';

const TICKET_ID = randomUUID();
const TICKET = mockTicketSelect({ id: TICKET_ID });
const RETRIEVED_CHUNK_IDS = [randomUUID()];
const DIAGNOSIS = mockDiagnoseTicketResponse({ confidence: 0.9 });

describe('ProposeNode Unit Test', () => {
  let sut: ProposeNode;
  let proposeTicketActionAgent: jest.Mocked<ProposeTicketActionAgent>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ProposeNode).compile();

    sut = unit;
    proposeTicketActionAgent = unitRef.get(ProposeTicketActionAgent);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const STATE = mockTicketInvestigationGraphState({
    ticketId: TICKET_ID,
    ticket: TICKET,
    diagnosis: DIAGNOSIS,
    retrievedChunkIds: RETRIEVED_CHUNK_IDS,
  });

  describe('Given run', () => {
    describe('When propose-action succeeds', () => {
      test('Then it returns a completed early result', async () => {
        const proposal = mockProposeTicketActionResponse();
        proposeTicketActionAgent.propose.mockResolvedValue(proposal);

        const result = await sut.run(STATE);

        expect(proposeTicketActionAgent.propose).toHaveBeenCalledWith(TICKET, DIAGNOSIS);
        expect(result).toEqual({
          earlyResult: {
            retrievedChunkIds: RETRIEVED_CHUNK_IDS,
            diagnosis: DIAGNOSIS.diagnosis,
            diagnosisConfidence: DIAGNOSIS.confidence,
            proposedAction: proposal.action,
            proposedActionReasoning: proposal.reasoning,
            status: 'completed',
          },
        });
      });
    });

    describe('When propose-action fails', () => {
      test('Then it returns an early needs_review result', async () => {
        proposeTicketActionAgent.propose.mockRejectedValue(new Error('Gemini timed out'));

        const result = await sut.run(STATE);

        expect(result).toEqual({
          earlyResult: TicketInvestigationResultUtil.needsReviewResult(RETRIEVED_CHUNK_IDS, DIAGNOSIS),
        });
      });
    });

    describe('When called without a diagnosis', () => {
      test('Then it throws', async () => {
        await AssertUtils.assertError(
          () => sut.run(mockTicketInvestigationGraphState({ ...STATE, diagnosis: null })),
          `Ticket investigation graph reached propose for ${TICKET_ID} without a diagnosis`,
        );
      });
    });
  });
});
