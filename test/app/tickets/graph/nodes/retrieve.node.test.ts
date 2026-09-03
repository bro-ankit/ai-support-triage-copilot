import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { KbSearchService } from '../../../../../src/app/kb/search/kb-search.service';
import { RetrieveNode } from '../../../../../src/app/tickets/graph/nodes/retrieve.node';
import { TicketInvestigationResultUtil } from '../../../../../src/app/tickets/graph/ticket-investigation-result.util';
import { mockKbChunkSelect, mockTicketInvestigationGraphState } from '../../../../__mocks__';

const TICKET_ID = randomUUID();
const SEARCH_QUERY = 'Charged twice for order #4821';
const CHUNK = mockKbChunkSelect();
const STATE = mockTicketInvestigationGraphState({ ticketId: TICKET_ID, searchQuery: SEARCH_QUERY });

describe('RetrieveNode Unit Test', () => {
  let sut: RetrieveNode;
  let kbSearchService: jest.Mocked<KbSearchService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RetrieveNode).compile();

    sut = unit;
    kbSearchService = unitRef.get(KbSearchService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given run', () => {
    describe('When KB chunks are found', () => {
      test('Then it returns the chunks and their ids', async () => {
        kbSearchService.search.mockResolvedValue([CHUNK]);

        const result = await sut.run(STATE);

        expect(kbSearchService.search).toHaveBeenCalledWith(SEARCH_QUERY);
        expect(result).toEqual({ kbChunks: [CHUNK], retrievedChunkIds: [CHUNK.id] });
      });
    });

    describe('When no KB chunks are found', () => {
      test('Then it returns an early needs_review result instead of retrievedChunkIds', async () => {
        kbSearchService.search.mockResolvedValue([]);

        const result = await sut.run(STATE);

        expect(result).toEqual({ kbChunks: [], earlyResult: TicketInvestigationResultUtil.noFindingsResult() });
      });
    });
  });
});
