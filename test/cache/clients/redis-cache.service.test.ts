import { randomUUID } from 'node:crypto';

import { RedisCacheService } from '../../../src/cache/clients/redis-cache.service';
import { RedisTestEnvironment } from '../../helpers/redis-test-environment';

const INDEX_NAME = 'redis-cache-it-idx';
const KEY_PREFIX = 'redis-cache-it:';
const VECTOR_FIELD = 'embedding';
const DIMENSIONS = 4;

describe('RedisCacheService IT', () => {
  let sut: RedisCacheService;
  const env = new RedisTestEnvironment();

  beforeAll(async () => {
    await env.start();
    sut = env.module.get(RedisCacheService, { strict: false });
  }, 60_000);

  afterAll(async () => {
    await env.stop();
  });

  describe('Given increment and getCount', () => {
    describe('When a counter is incremented multiple times', () => {
      test('Then getCount reflects the real value stored in Redis', async () => {
        const key = `redis-cache-it:counter:${randomUUID()}`;

        await sut.increment(key);
        await sut.increment(key);
        const result = await sut.increment(key);

        expect(result).toBe(3);
        expect(await sut.getCount(key)).toBe(3);
      });
    });

    describe('When the counter key does not exist', () => {
      test('Then getCount returns 0', async () => {
        const result = await sut.getCount(`redis-cache-it:counter:${randomUUID()}`);

        expect(result).toBe(0);
      });
    });
  });

  describe('Given createVectorIndex, store, and findNearestVector', () => {
    beforeAll(async () => {
      await sut.createVectorIndex({
        indexName: INDEX_NAME,
        prefix: KEY_PREFIX,
        vectorField: VECTOR_FIELD,
        dimensions: DIMENSIONS,
        distanceMetric: 'COSINE',
      });
    });

    describe('When createVectorIndex is called again for an index that already exists', () => {
      test('Then it does not throw', async () => {
        await expect(
          sut.createVectorIndex({
            indexName: INDEX_NAME,
            prefix: KEY_PREFIX,
            vectorField: VECTOR_FIELD,
            dimensions: DIMENSIONS,
            distanceMetric: 'COSINE',
          }),
        ).resolves.toBeUndefined();
      });
    });

    describe('When index creation fails for a real, non-"already exists" reason', () => {
      test('Then it rethrows the real RediSearch error instead of swallowing it', async () => {
        await expect(
          sut.createVectorIndex({
            indexName: `redis-cache-it-invalid-${randomUUID()}`,
            prefix: 'redis-cache-it-invalid:',
            vectorField: VECTOR_FIELD,
            dimensions: 0,
            distanceMetric: 'COSINE',
          }),
        ).rejects.toThrow(/DIM/);
      });
    });

    describe('When a document close to the query vector was stored via store', () => {
      test('Then findNearestVector locates it via a real FT.SEARCH KNN query, within the real distance metric', async () => {
        const key = `${KEY_PREFIX}${randomUUID()}`;
        const embedding = [1, 0, 0, 0];
        await sut.store(key, { embedding, label: 'close-match' });

        const result = await sut.findNearestVector<{ label: string }>(INDEX_NAME, VECTOR_FIELD, [0.99, 0.01, 0, 0]);

        expect(result?.value.label).toBe('close-match');
        expect(result?.distance).toBeLessThan(0.01);
      });
    });

    describe('When store is called with a TTL', () => {
      test('Then the document actually expires from Redis, and the vector index reflects that expiry', async () => {
        const ttlIndexName = 'redis-cache-it-ttl-idx';
        const ttlPrefix = 'redis-cache-it-ttl:';
        await sut.createVectorIndex({
          indexName: ttlIndexName,
          prefix: ttlPrefix,
          vectorField: VECTOR_FIELD,
          dimensions: DIMENSIONS,
          distanceMetric: 'COSINE',
        });

        const key = `${ttlPrefix}${randomUUID()}`;
        await sut.store(key, { embedding: [0, 1, 0, 0], label: 'expiring' }, 1);

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const result = await sut.findNearestVector<{ label: string }>(ttlIndexName, VECTOR_FIELD, [0, 1, 0, 0]);

        expect(result).toBeUndefined();
      });
    });
  });
});
