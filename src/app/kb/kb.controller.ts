import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AUTH_SCOPES } from '../../auth/auth.constants';
import { RequireAuth } from '../../auth/decorators/require-auth.decorator';
import { IngestKbArticleCommand } from './commands/ingest-kb-article.command';
import { IngestKbArticleRequestDto } from './dto/ingest-kb-article-request.dto';
import { IngestKbArticleResponseDto } from './dto/ingest-kb-article-response.dto';
import { KbSearchQueryDto } from './dto/kb-search-query.dto';
import { KbSearchResultDto } from './dto/kb-search-result.dto';
import { KbSearchQuery } from './search/kb-search.query';

@ApiTags('kb')
@ApiBearerAuth()
@Controller('kb')
export class KbController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('articles')
  @RequireAuth(AUTH_SCOPES.MCP)
  @ApiOperation({ summary: 'Chunk, embed, and ingest a KB article or postmortem' })
  @ApiOkResponse({ type: IngestKbArticleResponseDto })
  ingestArticle(@Body() dto: IngestKbArticleRequestDto): Promise<IngestKbArticleResponseDto> {
    return this.commandBus.execute(new IngestKbArticleCommand(dto));
  }

  @Get('search')
  @RequireAuth(AUTH_SCOPES.MCP)
  @ApiOperation({ summary: 'Hybrid search: vector + keyword fused with RRF, reranked, top 3 chunks' })
  @ApiOkResponse({ type: [KbSearchResultDto] })
  search(@Query() dto: KbSearchQueryDto): Promise<KbSearchResultDto[]> {
    return this.queryBus.execute(new KbSearchQuery(dto.q));
  }
}
