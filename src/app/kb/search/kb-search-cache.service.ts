import { randomUUID } from 'node:crypto';

import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { EMBEDDING_DIMENSIONS } from '../../../ai/gemini/gemini.constants';
import { CACHE_CLIENT } from '../../../cache/cache.constants';
import type { ICacheClient } from '../../../cache/cache.interface';
import type { KbChunkSelect } from '../../../schema/kb-chunks.schema';
import { KB_SEARCH_CACHE_DEFAULTS } from './kb-search-cache.constants';

type CachedSearchEntry = {
  embedding: number[];
  results: KbChunkSelect[];
};

@Injectable()
export class KbSearchCacheService implements OnModuleInit {
  constructor(
    @InjectPinoLogger(KbSearchCacheService.name) private readonly logger: PinoLogger,
    @Inject(CACHE_CLIENT) private readonly cacheClient: ICacheClient,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cacheClient.createVectorIndex({
      indexName: KB_SEARCH_CACHE_DEFAULTS.INDEX_NAME,
      prefix: KB_SEARCH_CACHE_DEFAULTS.KEY_PREFIX,
      vectorField: KB_SEARCH_CACHE_DEFAULTS.VECTOR_FIELD,
      dimensions: EMBEDDING_DIMENSIONS,
      distanceMetric: 'COSINE',
    });
  }

  async findSimilar(embedding: number[]): Promise<KbChunkSelect[] | undefined> {
    const nearest = await this.cacheClient.findNearestVector<CachedSearchEntry>(
      KB_SEARCH_CACHE_DEFAULTS.INDEX_NAME,
      KB_SEARCH_CACHE_DEFAULTS.VECTOR_FIELD,
      embedding,
    );

    if (!nearest || nearest.distance > KB_SEARCH_CACHE_DEFAULTS.MAX_DISTANCE) {
      await this.cacheClient.increment(KB_SEARCH_CACHE_DEFAULTS.MISSES_KEY);
      return undefined;
    }

    this.logger.info({ distance: nearest.distance }, 'Semantic cache hit for KB search');
    await this.cacheClient.increment(KB_SEARCH_CACHE_DEFAULTS.HITS_KEY);
    return nearest.value.results;
  }

  async store(embedding: number[], results: KbChunkSelect[]): Promise<void> {
    const key = `${KB_SEARCH_CACHE_DEFAULTS.KEY_PREFIX}${randomUUID()}`;
    const entry: CachedSearchEntry = { embedding, results };
    await this.cacheClient.store(key, entry, KB_SEARCH_CACHE_DEFAULTS.TTL_SECONDS);
  }

  async getStats(): Promise<{ hits: number; misses: number; hitRate: number }> {
    const [hits, misses] = await Promise.all([
      this.cacheClient.getCount(KB_SEARCH_CACHE_DEFAULTS.HITS_KEY),
      this.cacheClient.getCount(KB_SEARCH_CACHE_DEFAULTS.MISSES_KEY),
    ]);
    const total = hits + misses;
    return { hits, misses, hitRate: total === 0 ? 0 : hits / total };
  }
}
