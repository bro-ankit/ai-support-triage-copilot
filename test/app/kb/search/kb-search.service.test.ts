import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import { KbChunkRepository } from '../../../../src/app/kb/repositories/kb-chunk.repository';
import { KbRerankerService } from '../../../../src/app/kb/search/kb-reranker.service';
import { SEARCH_DEFAULTS } from '../../../../src/app/kb/search/kb-search.constants';
import { KbSearchService } from '../../../../src/app/kb/search/kb-search.service';
import { mockKbChunkSelect } from '../../../__mocks__';

const QUERY = 'why is the checkout webhook not idempotent';
const EMBEDDING = [0.1, 0.2, 0.3];
const ARTICLE_ID = randomUUID();

const CHUNK_A = mockKbChunkSelect({ articleId: ARTICLE_ID, content: 'Webhook retries must be idempotent.' });
const CHUNK_B = mockKbChunkSelect({ articleId: ARTICLE_ID, content: 'Use an idempotency key per event.' });
const CHUNK_C = mockKbChunkSelect({ articleId: ARTICLE_ID, content: 'Unrelated billing export content.' });
const CHUNK_D = mockKbChunkSelect({ articleId: ARTICLE_ID, content: 'Also unrelated support macro content.' });

const CHUNK_A_ID = CHUNK_A.id;
const CHUNK_B_ID = CHUNK_B.id;
const CHUNK_C_ID = CHUNK_C.id;
const CHUNK_D_ID = CHUNK_D.id;
const UNKNOWN_CHUNK_ID = randomUUID();

describe('KbSearchService Unit Test', () => {
  let sut: KbSearchService;
  let aiClient: jest.Mocked<IAiClient>;
  let kbChunkRepository: jest.Mocked<KbChunkRepository>;
  let kbRerankerService: jest.Mocked<KbRerankerService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(KbSearchService).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    kbChunkRepository = unitRef.get(KbChunkRepository);
    kbRerankerService = unitRef.get(KbRerankerService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
  });

  describe('Given search', () => {
    describe('When candidates are found by both retrievers', () => {
      test('Then it embeds the query, fetches candidates within MAX_DISTANCE, and returns reranked chunks in rerank order', async () => {
        kbChunkRepository.findSimilarIds.mockResolvedValue([CHUNK_A_ID, CHUNK_B_ID]);
        kbChunkRepository.findByLexical.mockResolvedValue([CHUNK_B_ID, CHUNK_C_ID]);
        kbChunkRepository.findByIds.mockResolvedValue([CHUNK_B, CHUNK_A, CHUNK_C]);
        kbRerankerService.rerank.mockResolvedValue([
          { id: CHUNK_B_ID, score: 0.9 },
          { id: CHUNK_A_ID, score: 0.5 },
          { id: CHUNK_C_ID, score: 0.1 },
        ]);

        const result = await sut.search(QUERY);

        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(QUERY);
        expect(kbChunkRepository.findSimilarIds).toHaveBeenCalledWith(
          EMBEDDING,
          SEARCH_DEFAULTS.CANDIDATE_K,
          SEARCH_DEFAULTS.MAX_DISTANCE,
        );
        expect(kbChunkRepository.findByLexical).toHaveBeenCalledWith(QUERY, SEARCH_DEFAULTS.CANDIDATE_K);
        expect(kbChunkRepository.findByIds).toHaveBeenCalledWith([CHUNK_B_ID, CHUNK_A_ID, CHUNK_C_ID]);
        expect(kbRerankerService.rerank).toHaveBeenCalledWith(QUERY, [
          { id: CHUNK_B_ID, text: CHUNK_B.content },
          { id: CHUNK_A_ID, text: CHUNK_A.content },
          { id: CHUNK_C_ID, text: CHUNK_C.content },
        ]);
        expect(result).toEqual([CHUNK_B, CHUNK_A, CHUNK_C]);
      });
    });

    describe('When TOP_K is smaller than the reranked pool', () => {
      test('Then it returns only the top TOP_K chunks in rerank order', async () => {
        kbChunkRepository.findSimilarIds.mockResolvedValue([CHUNK_A_ID, CHUNK_D_ID]);
        kbChunkRepository.findByLexical.mockResolvedValue([CHUNK_B_ID, CHUNK_C_ID]);
        kbChunkRepository.findByIds.mockResolvedValue([CHUNK_A, CHUNK_B, CHUNK_C, CHUNK_D]);
        kbRerankerService.rerank.mockResolvedValue([
          { id: CHUNK_D_ID, score: 0.95 },
          { id: CHUNK_A_ID, score: 0.9 },
          { id: CHUNK_B_ID, score: 0.8 },
          { id: CHUNK_C_ID, score: 0.7 },
        ]);

        const result = await sut.search(QUERY);

        expect(result).toEqual([CHUNK_D, CHUNK_A, CHUNK_B]);
      });
    });

    describe('When neither retriever returns any candidates', () => {
      test('Then it returns an empty array without calling findByIds or rerank', async () => {
        kbChunkRepository.findSimilarIds.mockResolvedValue([]);
        kbChunkRepository.findByLexical.mockResolvedValue([]);

        const result = await sut.search(QUERY);

        expect(result).toEqual([]);
        expect(kbChunkRepository.findByIds).not.toHaveBeenCalled();
        expect(kbRerankerService.rerank).not.toHaveBeenCalled();
      });
    });

    describe('When the reranker returns an id no longer present in the hydrated pool', () => {
      test('Then it silently drops that id from the results', async () => {
        kbChunkRepository.findSimilarIds.mockResolvedValue([CHUNK_A_ID]);
        kbChunkRepository.findByLexical.mockResolvedValue([]);
        kbChunkRepository.findByIds.mockResolvedValue([CHUNK_A]);
        kbRerankerService.rerank.mockResolvedValue([
          { id: CHUNK_A_ID, score: 0.9 },
          { id: UNKNOWN_CHUNK_ID, score: 0.5 },
        ]);

        const result = await sut.search(QUERY);

        expect(result).toEqual([CHUNK_A]);
      });
    });
  });
});
