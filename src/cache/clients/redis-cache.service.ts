import { Inject, Injectable } from '@nestjs/common';
import { SCHEMA_FIELD_TYPE } from 'redis';

import type { ICacheClient } from '../cache.interface';
import type { NearestVectorMatch, VectorIndexOptions } from '../cache.types';
import { REDIS_CLIENT } from './redis-cache.constants';
import type { RedisCacheClient } from './redis-cache.types';

const INDEX_ALREADY_EXISTS_ERROR = 'Index already exists';

@Injectable()
export class RedisCacheService implements ICacheClient {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: RedisCacheClient) { }

  async increment(key: string): Promise<number> {
    return this.redisClient.incr(key);
  }

  async getCount(key: string): Promise<number> {
    const value = await this.redisClient.get(key);
    return value ? Number(value) : 0;
  }

  async createVectorIndex(options: VectorIndexOptions): Promise<void> {
    try {
      await this.redisClient.ft.create(
        options.indexName,
        {
          [`$.${options.vectorField}`]: {
            type: SCHEMA_FIELD_TYPE.VECTOR,
            AS: options.vectorField,
            ALGORITHM: 'HNSW',
            TYPE: 'FLOAT32',
            DIM: options.dimensions,
            DISTANCE_METRIC: options.distanceMetric,
          },
        },
        { ON: 'JSON', PREFIX: options.prefix },
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes(INDEX_ALREADY_EXISTS_ERROR)) return;
      throw error;
    }
  }

  async store(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.redisClient.json.set(key, '$', value);
    if (ttlSeconds) await this.redisClient.expire(key, ttlSeconds);
  }

  async findNearestVector<T>(
    indexName: string,
    vectorField: string,
    vector: number[],
  ): Promise<NearestVectorMatch<T> | undefined> {
    const result = await this.redisClient.ft.search(indexName, `*=>[KNN 1 @${vectorField} $vec AS distance]`, {
      PARAMS: { vec: Buffer.from(new Float32Array(vector).buffer) },
      SORTBY: 'distance',
      DIALECT: 2,
      RETURN: ['distance', '$'],
    });

    const best = result.documents[0];
    if (!best) return undefined;

    return { distance: Number(best.value.distance), value: best.value as unknown as T };
  }
}
