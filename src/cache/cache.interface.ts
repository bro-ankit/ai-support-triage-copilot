import type { NearestVectorMatch, VectorIndexOptions } from './cache.types';

export interface ICacheClient {
  createVectorIndex(options: VectorIndexOptions): Promise<void>;
  store(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  findNearestVector<T>(
    indexName: string,
    vectorField: string,
    vector: number[],
    filter?: Record<string, string>,
  ): Promise<NearestVectorMatch<T> | undefined>;
  increment(key: string): Promise<number>;
  getCount(key: string): Promise<number>;
}
