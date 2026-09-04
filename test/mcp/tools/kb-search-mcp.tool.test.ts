import { TestBed } from '@automock/jest';
import { Reflector } from '@nestjs/core';

import { KbSearchService } from '../../../src/app/kb/search/kb-search.service';
import { AUTH_SCOPES } from '../../../src/auth/auth.constants';
import { MCP_TOOL_KEY, type McpToolMetadata } from '../../../src/mcp/mcp-tool.decorator';
import { KbSearchMcpTool } from '../../../src/mcp/tools/kb-search-mcp.tool';
import { mockKbChunkSelect } from '../../__mocks__';

describe('KbSearchMcpTool', () => {
  let sut: KbSearchMcpTool;
  let kbSearchService: jest.Mocked<KbSearchService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(KbSearchMcpTool).compile();

    sut = unit;
    kbSearchService = unitRef.get(KbSearchService);
  });

  describe('Given the @McpTool metadata on searchKb', () => {
    test('Then it is registered as search_kb, with a description, input schema, and output schema, requiring the mcp scope', () => {
      const meta = new Reflector().get<McpToolMetadata>(MCP_TOOL_KEY, KbSearchMcpTool.prototype.searchKb);

      expect(meta).toEqual({
        name: 'search_kb',
        description: 'Search the knowledge base for articles relevant to a customer support issue',
        inputSchema: expect.any(Object),
        outputSchema: expect.any(Object),
        requiredScopes: [AUTH_SCOPES.MCP],
      });
    });
  });

  describe('Given searchKb is called with a query', () => {
    describe('When KbSearchService returns results', () => {
      test('Then it delegates to KbSearchService.search and returns both text content and structuredContent matching outputSchema', async () => {
        const chunk = mockKbChunkSelect({ content: 'Webhook retries must be idempotent.' });
        kbSearchService.search.mockResolvedValue({ chunks: [chunk], isConfident: true });

        const result = await sut.searchKb({ query: 'webhook retries' });

        expect(kbSearchService.search).toHaveBeenCalledWith('webhook retries');
        const expectedResults = [
          {
            id: chunk.id,
            articleId: chunk.articleId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            createdAt: chunk.createdAt,
          },
        ];
        expect(result).toEqual({
          content: [{ type: 'text', text: JSON.stringify({ results: expectedResults }) }],
          structuredContent: { results: expectedResults },
        });
      });
    });

    describe('When KbSearchService returns no results', () => {
      test('Then it still returns a valid CallToolResult with an empty results array', async () => {
        kbSearchService.search.mockResolvedValue({ chunks: [], isConfident: true });

        const result = await sut.searchKb({ query: 'nothing matches' });

        expect(result).toEqual({
          content: [{ type: 'text', text: JSON.stringify({ results: [] }) }],
          structuredContent: { results: [] },
        });
      });
    });
  });
});
