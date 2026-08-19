import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { KB_COMMAND_HANDLERS } from './commands';
import { KbController } from './kb.controller';
import { KbArticleRepository } from './repositories/kb-article.repository';
import { KbChunkRepository } from './repositories/kb-chunk.repository';
import { KbRerankerService } from './search/kb-reranker.service';
import { KbSearchQueryHandler } from './search/kb-search.query-handler';
import { KbSearchService } from './search/kb-search.service';

@Module({
  imports: [CqrsModule],
  providers: [
    KbArticleRepository,
    KbChunkRepository,
    KbRerankerService,
    KbSearchService,
    KbSearchQueryHandler,
    ...KB_COMMAND_HANDLERS,
  ],
  controllers: [KbController],
  exports: [KbSearchService],
})
export class KbModule {}
