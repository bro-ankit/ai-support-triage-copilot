import { TestBed } from '@automock/jest';

import { EMBEDDING_DIMENSIONS } from '../../../../src/ai/gemini/gemini.constants';
import { KbSearchCacheService } from '../../../../src/app/kb/search/kb-search-cache.service';
import { KB_SEARCH_CACHE_DEFAULTS } from '../../../../src/app/kb/search/kb-search-cache.constants';
import { CACHE_CLIENT } from '../../../../src/cache/cache.constants';
import type { ICacheClient } from '../../../../src/cache/cache.interface';
import { mockKbChunkSelect } from '../../../__mocks__';

const EMBEDDING = [0.1, 0.2, 0.3];
const RESULTS = [mockKbChunkSelect()];

describe('KbSearchCacheService Unit Test', () => {
  let sut: KbSearchCacheService;
  let cacheClient: jest.Mocked<ICacheClient>;

  beforeAll(() => {
    const mockedCacheClient: jest.Mocked<ICacheClient> = {
      createVectorIndex: jest.fn(),
      store: jest.fn(),
      findNearestVector: jest.fn(),
      increment: jest.fn(),
      getCount: jest.fn(),
    };

    const { unit, unitRef } = TestBed.create(KbSearchCacheService)
      .mock(CACHE_CLIENT)
      .using(mockedCacheClient)
      .compile();

    sut = unit;
    cacheClient = unitRef.get(CACHE_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given onModuleInit', () => {
    describe('When called', () => {
      test('Then it creates the vector index for the embedding field with the configured dimensions', async () => {
        await sut.onModuleInit();

        expect(cacheClient.createVectorIndex).toHaveBeenCalledWith({
          indexName: KB_SEARCH_CACHE_DEFAULTS.INDEX_NAME,
          prefix: KB_SEARCH_CACHE_DEFAULTS.KEY_PREFIX,
          vectorField: 'embedding',
          dimensions: EMBEDDING_DIMENSIONS,
          distanceMetric: 'COSINE',
        });
      });
    });
  });

  describe('Given findSimilar', () => {
    describe('When the nearest match is within MAX_DISTANCE', () => {
      test('Then it records a hit and returns the cached results', async () => {
        cacheClient.findNearestVector.mockResolvedValue({
          distance: KB_SEARCH_CACHE_DEFAULTS.MAX_DISTANCE,
          value: { embedding: EMBEDDING, results: RESULTS },
        });

        const result = await sut.findSimilar(EMBEDDING);

        expect(cacheClient.findNearestVector).toHaveBeenCalledWith(
          KB_SEARCH_CACHE_DEFAULTS.INDEX_NAME,
          'embedding',
          EMBEDDING,
        );
        expect(cacheClient.increment).toHaveBeenCalledWith(KB_SEARCH_CACHE_DEFAULTS.HITS_KEY);
        expect(cacheClient.increment).not.toHaveBeenCalledWith(KB_SEARCH_CACHE_DEFAULTS.MISSES_KEY);
        expect(result).toEqual(RESULTS);
      });
    });

    describe('When the nearest match is beyond MAX_DISTANCE', () => {
      test('Then it records a miss and returns undefined', async () => {
        cacheClient.findNearestVector.mockResolvedValue({
          distance: KB_SEARCH_CACHE_DEFAULTS.MAX_DISTANCE + 0.01,
          value: { embedding: EMBEDDING, results: RESULTS },
        });

        const result = await sut.findSimilar(EMBEDDING);

        expect(cacheClient.increment).toHaveBeenCalledWith(KB_SEARCH_CACHE_DEFAULTS.MISSES_KEY);
        expect(result).toBeUndefined();
      });
    });

    describe('When there is no cached entry at all', () => {
      test('Then it records a miss and returns undefined', async () => {
        cacheClient.findNearestVector.mockResolvedValue(undefined);

        const result = await sut.findSimilar(EMBEDDING);

        expect(cacheClient.increment).toHaveBeenCalledWith(KB_SEARCH_CACHE_DEFAULTS.MISSES_KEY);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('Given store', () => {
    describe('When called', () => {
      test('Then it stores the embedding and results as a JSON document under the key prefix with the configured TTL', async () => {
        await sut.store(EMBEDDING, RESULTS);

        expect(cacheClient.store).toHaveBeenCalledTimes(1);
        const [key, value, ttlSeconds] = cacheClient.store.mock.calls[0];
        expect(key.startsWith(KB_SEARCH_CACHE_DEFAULTS.KEY_PREFIX)).toBe(true);
        expect(value).toEqual({ embedding: EMBEDDING, results: RESULTS });
        expect(ttlSeconds).toBe(KB_SEARCH_CACHE_DEFAULTS.TTL_SECONDS);
      });
    });
  });

  describe('Given getStats', () => {
    describe('When there have been both hits and misses', () => {
      test('Then it returns hits, misses, and the computed hit rate', async () => {
        cacheClient.getCount.mockImplementation(async (key: string) =>
          key === KB_SEARCH_CACHE_DEFAULTS.HITS_KEY ? 3 : 1,
        );

        const result = await sut.getStats();

        expect(result).toEqual({ hits: 3, misses: 1, hitRate: 0.75 });
      });
    });

    describe('When there have been no hits or misses', () => {
      test('Then it returns a hit rate of 0 without dividing by zero', async () => {
        cacheClient.getCount.mockResolvedValue(0);

        const result = await sut.getStats();

        expect(result).toEqual({ hits: 0, misses: 0, hitRate: 0 });
      });
    });
  });
});
