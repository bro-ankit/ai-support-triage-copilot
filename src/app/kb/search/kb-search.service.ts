import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { IAiClient } from '../../../ai/ai.interface';
import { TrackAiUsage } from '../../../metrics/track-ai-usage.decorator';
import type { KbChunkSelect } from '../../../schema/kb-chunks.schema';
import { Traced } from '../../../tracing/traced.decorator';
import { KbChunkRepository } from '../repositories/kb-chunk.repository';
import { KbRerankerService } from './kb-reranker.service';
import { MULTI_HOP_DEFAULTS, SEARCH_DEFAULTS } from './kb-search.constants';
import { KbSearchCacheService } from './kb-search-cache.service';
import { RrfUtil } from './rrf.util';

type KbSearchWithConfidence = { chunks: KbChunkSelect[]; isConfident: boolean };

@Injectable()
export class KbSearchService {
  constructor(
    @InjectPinoLogger(KbSearchService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly kbChunkRepository: KbChunkRepository,
    private readonly kbRerankerService: KbRerankerService,
    private readonly kbSearchCacheService: KbSearchCacheService,
  ) {}

  @Traced<[string], KbSearchWithConfidence>(
    'retrieve',
    (query) => ({ 'kb.query_length': query.length }),
    (result) => ({ 'kb.chunks_found': result.chunks.length, 'kb.is_confident': result.isConfident }),
  )
  @TrackAiUsage('EMBEDDING')
  async search(query: string): Promise<KbSearchWithConfidence> {
    this.logger.info({ query }, 'Hybrid KB search request');

    const embedding = await this.aiClient.generateEmbedding(query);

    const cached = await this.kbSearchCacheService.findSimilar(embedding);
    if (cached) return { chunks: cached, isConfident: true };

    const { chunks, topScore } = await this.hybridSearch(query, embedding);
    await this.kbSearchCacheService.store(embedding, chunks);
    return { chunks, isConfident: topScore >= MULTI_HOP_DEFAULTS.CONFIDENCE_THRESHOLD };
  }

  private async hybridSearch(
    query: string,
    embedding: number[],
  ): Promise<{ chunks: KbChunkSelect[]; topScore: number }> {
    const [vectorIds, lexicalIds] = await Promise.all([
      this.kbChunkRepository.findSimilarIds(embedding, SEARCH_DEFAULTS.CANDIDATE_K, SEARCH_DEFAULTS.MAX_DISTANCE),
      this.kbChunkRepository.findByLexical(query, SEARCH_DEFAULTS.CANDIDATE_K),
    ]);

    this.logger.debug({ vectorCount: vectorIds.length, lexicalCount: lexicalIds.length }, 'Candidate sets');

    const fused = RrfUtil.fuse(vectorIds, lexicalIds);
    const poolIds = fused.slice(0, SEARCH_DEFAULTS.RERANK_POOL_K).map((r) => r.id);

    this.logger.debug({ poolIds }, 'RRF-fused rerank pool');

    if (poolIds.length === 0) return { chunks: [], topScore: -Infinity };

    const pool = await this.kbChunkRepository.findByIds(poolIds);
    const byId = new Map(pool.map((c) => [c.id, c]));

    const candidates = pool.map((c) => ({ id: c.id, text: c.content }));
    const reranked = await this.kbRerankerService.rerank(query, candidates);

    this.logger.info({ scores: reranked.slice(0, SEARCH_DEFAULTS.TOP_K) }, 'Cross-encoder rerank scores');

    const topScore = reranked[0]?.score ?? -Infinity;
    const chunks = reranked.slice(0, SEARCH_DEFAULTS.TOP_K).flatMap((r) => {
      const chunk = byId.get(r.id);
      return chunk ? [chunk] : [];
    });

    return { chunks, topScore };
  }
}
