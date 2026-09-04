import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { KbSearchService } from '../../../../../src/app/kb/search/kb-search.service';
import { MultiHopQueryAgent } from '../../../../../src/app/tickets/agents/multi-hop-query.agent';
import { RetrieveNode } from '../../../../../src/app/tickets/graph/nodes/retrieve.node';
import { TicketInvestigationResultUtil } from '../../../../../src/app/tickets/graph/ticket-investigation-result.util';
import { mockKbChunkSelect, mockTicketInvestigationGraphState, mockTicketSelect } from '../../../../__mocks__';

const TICKET_ID = randomUUID();
const SEARCH_QUERY = 'Charged twice for order #4821';
const TICKET = mockTicketSelect({ id: TICKET_ID });
const CHUNK = mockKbChunkSelect();
const STATE = mockTicketInvestigationGraphState({ ticketId: TICKET_ID, ticket: TICKET, searchQuery: SEARCH_QUERY });

describe('RetrieveNode Unit Test', () => {
  let sut: RetrieveNode;
  let kbSearchService: jest.Mocked<KbSearchService>;
  let multiHopQueryAgent: jest.Mocked<MultiHopQueryAgent>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RetrieveNode).compile();

    sut = unit;
    kbSearchService = unitRef.get(KbSearchService);
    multiHopQueryAgent = unitRef.get(MultiHopQueryAgent);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given run', () => {
    describe('When no KB chunks are found on hop 1', () => {
      test('Then it returns an early needs_review result and never asks for follow-up queries', async () => {
        kbSearchService.search.mockResolvedValue({ chunks: [], isConfident: false });

        const result = await sut.run(STATE);

        expect(kbSearchService.search).toHaveBeenCalledWith(SEARCH_QUERY);
        expect(result).toEqual({ kbChunks: [], earlyResult: TicketInvestigationResultUtil.noFindingsResult() });
        expect(multiHopQueryAgent.generateFollowUpQueries).not.toHaveBeenCalled();
      });
    });

    describe('When hop 1 is confident', () => {
      test('Then it returns hop 1 chunks directly without requesting follow-up queries', async () => {
        kbSearchService.search.mockResolvedValue({ chunks: [CHUNK], isConfident: true });

        const result = await sut.run(STATE);

        expect(result).toEqual({ kbChunks: [CHUNK], retrievedChunkIds: [CHUNK.id] });
        expect(multiHopQueryAgent.generateFollowUpQueries).not.toHaveBeenCalled();
      });
    });

    describe('When hop 1 is not confident and the query agent proposes follow-up queries', () => {
      test('Then it retrieves each follow-up hop and returns the deduplicated merged chunks', async () => {
        const hop2Chunk = mockKbChunkSelect();
        const hop3Chunk = mockKbChunkSelect();
        multiHopQueryAgent.generateFollowUpQueries.mockResolvedValue(['sub query 1', 'sub query 2']);
        kbSearchService.search.mockImplementation(async (query: string) => {
          if (query === SEARCH_QUERY) return { chunks: [CHUNK], isConfident: false };
          if (query === 'sub query 1') return { chunks: [hop2Chunk], isConfident: true };
          if (query === 'sub query 2') return { chunks: [hop3Chunk, CHUNK], isConfident: true };
          throw new Error(`Unexpected query: ${query}`);
        });

        const result = await sut.run(STATE);

        expect(multiHopQueryAgent.generateFollowUpQueries).toHaveBeenCalledWith(TICKET, `[[KB1]] ${CHUNK.content}`);
        expect(kbSearchService.search).toHaveBeenNthCalledWith(1, SEARCH_QUERY);
        expect(kbSearchService.search).toHaveBeenNthCalledWith(2, 'sub query 1');
        expect(kbSearchService.search).toHaveBeenNthCalledWith(3, 'sub query 2');
        expect(result).toEqual({
          kbChunks: [CHUNK, hop2Chunk, hop3Chunk],
          retrievedChunkIds: [CHUNK.id, hop2Chunk.id, hop3Chunk.id],
        });
      });
    });

    describe('When hop 1 is not confident but the query agent proposes no follow-up queries', () => {
      test('Then it falls back to the hop 1 chunks without retrieving further', async () => {
        kbSearchService.search.mockResolvedValue({ chunks: [CHUNK], isConfident: false });
        multiHopQueryAgent.generateFollowUpQueries.mockResolvedValue([]);

        const result = await sut.run(STATE);

        expect(kbSearchService.search).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ kbChunks: [CHUNK], retrievedChunkIds: [CHUNK.id] });
      });
    });
  });
});
