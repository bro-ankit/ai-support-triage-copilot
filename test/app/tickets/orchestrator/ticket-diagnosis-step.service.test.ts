import { TestBed } from '@automock/jest';

import { DiagnoseTicketAgent } from '../../../../src/app/tickets/agents/diagnose-ticket.agent';
import { TicketDiagnosisStepService } from '../../../../src/app/tickets/orchestrator/steps/ticket-diagnosis-step.service';
import { ProposeTicketActionAgent } from '../../../../src/app/tickets/agents/propose-ticket-action.agent';
import { KbSearchService } from '../../../../src/app/kb/search/kb-search.service';
import { EpisodicMemoryService } from '../../../../src/app/tickets/memory/episodic-memory.service';
import { TICKETS_ERRORS } from '../../../../src/app/tickets/tickets.constants';
import {
  mockDiagnoseTicketResponse,
  mockKbChunkSelect,
  mockProposeTicketActionResponse,
  mockSimilarPastCase,
  mockTicketSelect,
} from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET = mockTicketSelect();
const SEARCH_QUERY = 'Charged twice for order #4821';
const CHUNK = mockKbChunkSelect();

describe('TicketDiagnosisStepService Unit Test', () => {
  let sut: TicketDiagnosisStepService;
  let kbSearchService: jest.Mocked<KbSearchService>;
  let episodicMemoryService: jest.Mocked<EpisodicMemoryService>;
  let diagnoseTicketAgent: jest.Mocked<DiagnoseTicketAgent>;
  let proposeTicketActionAgent: jest.Mocked<ProposeTicketActionAgent>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(TicketDiagnosisStepService).compile();

    sut = unit;
    kbSearchService = unitRef.get(KbSearchService);
    episodicMemoryService = unitRef.get(EpisodicMemoryService);
    diagnoseTicketAgent = unitRef.get(DiagnoseTicketAgent);
    proposeTicketActionAgent = unitRef.get(ProposeTicketActionAgent);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    episodicMemoryService.recall.mockResolvedValue([]);
  });

  describe('Given run', () => {
    describe('When no KB chunks are found', () => {
      test('Then it returns a needs_review result without calling the diagnosis agent', async () => {
        kbSearchService.search.mockResolvedValue([]);

        const result = await sut.run(TICKET, SEARCH_QUERY);

        expect(diagnoseTicketAgent.diagnose).not.toHaveBeenCalled();
        expect(result).toEqual({
          retrievedChunkIds: [],
          diagnosis: 'No relevant knowledge-base articles were found for this ticket.',
          diagnosisConfidence: 0,
          proposedAction: null,
          proposedActionReasoning: null,
          status: 'needs_review',
        });
      });
    });

    describe('When diagnosis fails', () => {
      test('Then it returns a failed result without calling the propose-action agent', async () => {
        kbSearchService.search.mockResolvedValue([CHUNK]);
        diagnoseTicketAgent.diagnose.mockRejectedValue(new Error('Gemini timed out'));

        const result = await sut.run(TICKET, SEARCH_QUERY);

        expect(proposeTicketActionAgent.propose).not.toHaveBeenCalled();
        expect(result).toEqual({
          retrievedChunkIds: [CHUNK.id],
          diagnosis: '(diagnosis failed, see logs for the underlying error)',
          diagnosisConfidence: 0,
          proposedAction: null,
          proposedActionReasoning: null,
          status: 'failed',
        });
      });
    });

    describe('When diagnosis confidence is below the threshold', () => {
      test('Then it returns a needs_review result without calling the propose-action agent', async () => {
        kbSearchService.search.mockResolvedValue([CHUNK]);
        const diagnosis = mockDiagnoseTicketResponse({ confidence: 0.2 });
        diagnoseTicketAgent.diagnose.mockResolvedValue(diagnosis);

        const result = await sut.run(TICKET, SEARCH_QUERY);

        expect(proposeTicketActionAgent.propose).not.toHaveBeenCalled();
        expect(result).toEqual({
          retrievedChunkIds: [CHUNK.id],
          diagnosis: diagnosis.diagnosis,
          diagnosisConfidence: 0.2,
          proposedAction: null,
          proposedActionReasoning: null,
          status: 'needs_review',
        });
      });
    });

    describe('When diagnosis confidence clears the threshold but propose-action fails', () => {
      test('Then it returns a needs_review result with the diagnosis kept', async () => {
        kbSearchService.search.mockResolvedValue([CHUNK]);
        const diagnosis = mockDiagnoseTicketResponse({ confidence: 0.9 });
        diagnoseTicketAgent.diagnose.mockResolvedValue(diagnosis);
        proposeTicketActionAgent.propose.mockRejectedValue(new Error('Gemini timed out'));

        const result = await sut.run(TICKET, SEARCH_QUERY);

        expect(result).toEqual({
          retrievedChunkIds: [CHUNK.id],
          diagnosis: diagnosis.diagnosis,
          diagnosisConfidence: 0.9,
          proposedAction: null,
          proposedActionReasoning: null,
          status: 'needs_review',
        });
      });
    });

    describe('When diagnosis and propose-action both succeed', () => {
      test('Then it returns a completed result with the proposed action', async () => {
        kbSearchService.search.mockResolvedValue([CHUNK]);
        const diagnosis = mockDiagnoseTicketResponse({ confidence: 0.9 });
        const proposal = mockProposeTicketActionResponse();
        diagnoseTicketAgent.diagnose.mockResolvedValue(diagnosis);
        proposeTicketActionAgent.propose.mockResolvedValue(proposal);

        const result = await sut.run(TICKET, SEARCH_QUERY);

        expect(proposeTicketActionAgent.propose).toHaveBeenCalledWith(TICKET, diagnosis);
        expect(result).toEqual({
          retrievedChunkIds: [CHUNK.id],
          diagnosis: diagnosis.diagnosis,
          diagnosisConfidence: 0.9,
          proposedAction: proposal.action,
          proposedActionReasoning: proposal.reasoning,
          status: 'completed',
        });
      });
    });

    describe('When episodic recall returns no similar past tickets', () => {
      test('Then it diagnoses with an empty past-cases text and publishes a recalled event with a zero count', async () => {
        kbSearchService.search.mockResolvedValue([CHUNK]);
        diagnoseTicketAgent.diagnose.mockResolvedValue(mockDiagnoseTicketResponse());

        await sut.run(TICKET, SEARCH_QUERY);

        expect(episodicMemoryService.recall).toHaveBeenCalledWith(SEARCH_QUERY, TICKET.id);
        expect(diagnoseTicketAgent.diagnose).toHaveBeenCalledWith(TICKET, CHUNK.content, '');
      });
    });

    describe('When episodic recall returns similar past tickets', () => {
      test('Then it diagnoses with those cases formatted into the past-cases text', async () => {
        const pastCase = mockSimilarPastCase();
        kbSearchService.search.mockResolvedValue([CHUNK]);
        episodicMemoryService.recall.mockResolvedValue([pastCase]);
        diagnoseTicketAgent.diagnose.mockResolvedValue(mockDiagnoseTicketResponse());

        await sut.run(TICKET, SEARCH_QUERY);

        expect(diagnoseTicketAgent.diagnose).toHaveBeenCalledWith(
          TICKET,
          CHUNK.content,
          `Past ticket: ${pastCase.subject}\nDescription: ${pastCase.description}\n` +
            `Diagnosis: ${pastCase.diagnosis}\nResolution: ${pastCase.proposedAction}`,
        );
      });
    });

    describe('When the abort signal is already aborted before diagnosing', () => {
      test('Then it throws without calling the diagnosis agent', async () => {
        kbSearchService.search.mockResolvedValue([CHUNK]);
        const abortController = new AbortController();
        abortController.abort();

        await AssertUtils.assertError(
          () => sut.run(TICKET, SEARCH_QUERY, abortController.signal),
          TICKETS_ERRORS.INVESTIGATION_ABORTED,
        );
        expect(diagnoseTicketAgent.diagnose).not.toHaveBeenCalled();
      });
    });

    describe('When the abort signal is already aborted before proposing an action', () => {
      test('Then it throws without calling the propose-action agent', async () => {
        kbSearchService.search.mockResolvedValue([CHUNK]);
        const diagnosis = mockDiagnoseTicketResponse({ confidence: 0.9 });
        diagnoseTicketAgent.diagnose.mockResolvedValue(diagnosis);
        const abortController = new AbortController();
        diagnoseTicketAgent.diagnose.mockImplementation(async () => {
          abortController.abort();
          return diagnosis;
        });

        await AssertUtils.assertError(
          () => sut.run(TICKET, SEARCH_QUERY, abortController.signal),
          TICKETS_ERRORS.INVESTIGATION_ABORTED,
        );
        expect(proposeTicketActionAgent.propose).not.toHaveBeenCalled();
      });
    });
  });
});
