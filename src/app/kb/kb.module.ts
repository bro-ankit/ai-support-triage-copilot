import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { KB_COMMAND_HANDLERS } from './commands';
import { ContextualChunkService } from './helpers/contextual-chunk.service';
import { KbArticleIngestionService } from './kb-article-ingestion.service';
import { KbController } from './kb.controller';
import { KbArticleRepository } from './repositories/kb-article.repository';
import { KbChunkRepository } from './repositories/kb-chunk.repository';
import { KbSearchCacheService } from './search/kb-search-cache.service';
import { KbRerankerService } from './search/kb-reranker.service';
import { KbSearchQueryHandler } from './search/kb-search.query-handler';
import { KbSearchService } from './search/kb-search.service';

@Module({
  imports: [CqrsModule],
  providers: [
    KbArticleRepository,
    KbChunkRepository,
    KbRerankerService,
    KbSearchCacheService,
    KbSearchService,
    KbSearchQueryHandler,
    ContextualChunkService,
    KbArticleIngestionService,
    ...KB_COMMAND_HANDLERS,
  ],
  controllers: [KbController],
  exports: [KbSearchService],
})
export class KbModule {}
