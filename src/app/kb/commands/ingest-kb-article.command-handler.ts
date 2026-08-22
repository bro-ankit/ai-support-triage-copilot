import { randomUUID } from 'node:crypto';

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import pLimit from 'p-limit';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { IAiClient } from '../../../ai/ai.interface';
import { DrizzleTransactionService } from '../../../database/drizzle-transaction.service';
import { TrackAiUsage } from '../../../metrics/track-ai-usage.decorator';
import { IngestKbArticleResponseDto } from '../dto/ingest-kb-article-response.dto';
import { KbChunkingUtil } from '../helpers/kb-chunking.util';
import { TextSanitizerUtil } from '../helpers/text-sanitizer.util';
import { KbArticleRepository } from '../repositories/kb-article.repository';
import { KbChunkRepository } from '../repositories/kb-chunk.repository';
import { IngestKbArticleCommand } from './ingest-kb-article.command';
import { INGEST_KB_ARTICLE_DEFAULTS } from './ingest-kb-article.constants';

@CommandHandler(IngestKbArticleCommand)
export class IngestKbArticleCommandHandler
  implements ICommandHandler<IngestKbArticleCommand, IngestKbArticleResponseDto> {
  constructor(
    @InjectPinoLogger(IngestKbArticleCommandHandler.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly dbTransactionService: DrizzleTransactionService,
    private readonly kbArticleRepository: KbArticleRepository,
    private readonly kbChunkRepository: KbChunkRepository,
  ) { }

  @TrackAiUsage('EMBEDDING')
  async execute(command: IngestKbArticleCommand): Promise<IngestKbArticleResponseDto> {
    const { dto } = command;
    const sanitizedContent = TextSanitizerUtil.stripHiddenCharacters(dto.rawContent);
    const chunks = KbChunkingUtil.chunkArticle(sanitizedContent);

    this.logger.info({ title: dto.title, chunkCount: chunks.length }, 'Ingesting KB article');

    const limit = pLimit(INGEST_KB_ARTICLE_DEFAULTS.EMBED_CONCURRENCY);
    const embeddings = await Promise.all(
      chunks.map((chunk) => limit(() => this.aiClient.generateEmbedding(chunk.content))),
    );

    const articleId = randomUUID();

    const article = await this.dbTransactionService.execute(async () => {
      const insertedArticle = await this.kbArticleRepository.insert({
        id: articleId,
        title: dto.title,
        sourceType: dto.sourceType,
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
