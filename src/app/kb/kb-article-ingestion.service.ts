import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import pLimit from 'p-limit';

import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient } from '../../ai/ai.interface';
import { DrizzleTransactionService } from '../../database/drizzle-transaction.service';
import { TrackAiUsage } from '../../metrics/track-ai-usage.decorator';
import type { KbSourceType } from '../../schema/kb-articles.schema';
import { IngestKbArticleResponseDto } from './dto/ingest-kb-article-response.dto';
import { ContextualChunkService } from './helpers/contextual-chunk.service';
import { INGEST_KB_ARTICLE_DEFAULTS } from './commands/ingest-kb-article.constants';
import { KbChunkingUtil } from './helpers/kb-chunking.util';
import { TextSanitizerUtil } from './helpers/text-sanitizer.util';
import { KbArticleRepository } from './repositories/kb-article.repository';
import { KbChunkRepository } from './repositories/kb-chunk.repository';

@Injectable()
export class KbArticleIngestionService {
  constructor(
    @InjectPinoLogger(KbArticleIngestionService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly dbTransactionService: DrizzleTransactionService,
    private readonly kbArticleRepository: KbArticleRepository,
    private readonly kbChunkRepository: KbChunkRepository,
    private readonly contextualChunkService: ContextualChunkService,
  ) { }

  @TrackAiUsage('EMBEDDING')
  async ingest(title: string, sourceType: KbSourceType, rawContent: string): Promise<IngestKbArticleResponseDto> {
    const sanitizedContent = TextSanitizerUtil.stripHiddenCharacters(rawContent);
    const rawChunks = KbChunkingUtil.chunkArticle(sanitizedContent);

    this.logger.info({ title, chunkCount: rawChunks.length }, 'Ingesting KB article');

    const chunks = await this.contextualChunkService.enrichChunks(sanitizedContent, rawChunks);

    const limit = pLimit(INGEST_KB_ARTICLE_DEFAULTS.EMBED_CONCURRENCY);
    const embeddings = await Promise.all(
      chunks.map((chunk) => limit(() => this.aiClient.generateEmbedding(chunk.content))),
    );

    const articleId = randomUUID();

    const article = await this.dbTransactionService.execute(async () => {
      const insertedArticle = await this.kbArticleRepository.insert({
        id: articleId,
        title,
        sourceType,
        rawContent: sanitizedContent,
      });

      await this.kbChunkRepository.insertMany(
        chunks.map((chunk, index) => ({
          id: randomUUID(),
          articleId: insertedArticle.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: KbChunkingUtil.estimateTokenCount(chunk.content),
          embedding: embeddings[index],
        })),
      );

      return insertedArticle;
    });

    return plainToInstance(
      IngestKbArticleResponseDto,
      { id: article.id, title: article.title, chunkCount: chunks.length },
      { excludeExtraneousValues: true },
    );
  }
}
