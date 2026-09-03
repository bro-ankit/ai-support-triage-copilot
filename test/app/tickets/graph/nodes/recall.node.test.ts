import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { RecallNode } from '../../../../../src/app/tickets/graph/nodes/recall.node';
import { EpisodicMemoryService } from '../../../../../src/app/tickets/memory/episodic-memory.service';
import { mockSimilarPastCase, mockTicketInvestigationGraphState } from '../../../../__mocks__';

const TICKET_ID = randomUUID();
const SEARCH_QUERY = 'Charged twice for order #4821';
const STATE = mockTicketInvestigationGraphState({ ticketId: TICKET_ID, searchQuery: SEARCH_QUERY });

describe('RecallNode Unit Test', () => {
  let sut: RecallNode;
  let episodicMemoryService: jest.Mocked<EpisodicMemoryService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RecallNode).compile();

    sut = unit;
    episodicMemoryService = unitRef.get(EpisodicMemoryService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given run', () => {
    describe('When similar past cases are found', () => {
      test('Then it recalls using the search query and returns the past cases', async () => {
        const pastCase = mockSimilarPastCase();
        episodicMemoryService.recall.mockResolvedValue([pastCase]);

        const result = await sut.run(STATE);

        expect(episodicMemoryService.recall).toHaveBeenCalledWith(SEARCH_QUERY, TICKET_ID);
        expect(result).toEqual({ pastCases: [pastCase] });
      });
    });

    describe('When no similar past cases are found', () => {
      test('Then it returns an empty past cases array', async () => {
        episodicMemoryService.recall.mockResolvedValue([]);

        const result = await sut.run(STATE);

        expect(result).toEqual({ pastCases: [] });
      });
    });
  });
});
