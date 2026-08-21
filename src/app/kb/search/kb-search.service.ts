import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { IAiClient } from '../../../ai/ai.interface';
import { TrackAiUsage } from '../../../metrics/track-ai-usage.decorator';
import type { KbChunkSelect } from '../../../schema/kb-chunks.schema';
import { KbChunkRepository } from '../repositories/kb-chunk.repository';
import { KbSearchCacheService } from './kb-search-cache.service';
import { KbRerankerService } from './kb-reranker.service';
import { RrfUtil } from './rrf.util';
import { SEARCH_DEFAULTS } from './kb-search.constants';

@Injectable()
export class KbSearchService {
  constructor(
    @InjectPinoLogger(KbSearchService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly kbChunkRepository: KbChunkRepository,
    private readonly kbRerankerService: KbRerankerService,
    private readonly kbSearchCacheService: KbSearchCacheService,
  ) {}

  @TrackAiUsage('EMBEDDING')
  async search(query: string): Promise<KbChunkSelect[]> {
    this.logger.info({ query }, 'Hybrid KB search request');

    const embedding = await this.aiClient.generateEmbedding(query);

    const cached = await this.kbSearchCacheService.findSimilar(embedding);
    if (cached) return cached;

    const results = await this.hybridSearch(query, embedding);
    await this.kbSearchCacheService.store(embedding, results);
    return results;
  }

  private async hybridSearch(query: string, embedding: number[]): Promise<KbChunkSelect[]> {
    const [vectorIds, lexicalIds] = await Promise.all([
      this.kbChunkRepository.findSimilarIds(embedding, SEARCH_DEFAULTS.CANDIDATE_K, SEARCH_DEFAULTS.MAX_DISTANCE),
      this.kbChunkRepository.findByLexical(query, SEARCH_DEFAULTS.CANDIDATE_K),
    ]);

    this.logger.debug({ vectorCount: vectorIds.length, lexicalCount: lexicalIds.length }, 'Candidate sets');

    const fused = RrfUtil.fuse(vectorIds, lexicalIds);
    const poolIds = fused.slice(0, SEARCH_DEFAULTS.RERANK_POOL_K).map((r) => r.id);

    this.logger.debug({ poolIds }, 'RRF-fused rerank pool');

    if (poolIds.length === 0) return [];

    const pool = await this.kbChunkRepository.findByIds(poolIds);
    const byId = new Map(pool.map((c) => [c.id, c]));

    const candidates = pool.map((c) => ({ id: c.id, text: c.content }));
    const reranked = await this.kbRerankerService.rerank(query, candidates);

    this.logger.info({ scores: reranked.slice(0, SEARCH_DEFAULTS.TOP_K) }, 'Cross-encoder rerank scores');

    return reranked.slice(0, SEARCH_DEFAULTS.TOP_K).flatMap((r) => {
      const chunk = byId.get(r.id);
      return chunk ? [chunk] : [];
    });
  }
}
