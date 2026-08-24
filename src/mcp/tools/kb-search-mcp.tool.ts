import { Injectable } from '@nestjs/common';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { plainToInstance } from 'class-transformer';
import { z } from 'zod';

import { KbSearchResultDto } from '../../app/kb/dto/kb-search-result.dto';
import { KbSearchService } from '../../app/kb/search/kb-search.service';
import { AUTH_SCOPES } from '../../auth/auth.constants';
import { McpTool } from '../mcp-tool.decorator';

const SearchKbInputSchema = {
  query: z.string().min(1).describe('The support question or issue description to search the knowledge base for'),
};

const SearchKbOutputSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      articleId: z.string(),
      chunkIndex: z.number(),
      content: z.string(),
      createdAt: z.date(),
    }),
  ),
});

@Injectable()
export class KbSearchMcpTool {
  constructor(private readonly kbSearchService: KbSearchService) { }

  @McpTool({
    name: 'search_kb',
    description: 'Search the knowledge base for articles relevant to a customer support issue',
    inputSchema: SearchKbInputSchema,
    outputSchema: SearchKbOutputSchema,
    requiredScopes: [AUTH_SCOPES.MCP],
  })
  async searchKb({ query }: { query: string }): Promise<CallToolResult> {
    const chunks = await this.kbSearchService.search(query);
    const results = plainToInstance(KbSearchResultDto, chunks, { excludeExtraneousValues: true });

    return {
      content: [{ type: 'text', text: JSON.stringify({ results }) }],
      structuredContent: { results },
    };
  }
}
