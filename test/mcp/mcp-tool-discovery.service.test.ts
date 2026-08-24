import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import type { CallToolResult, ServerContext } from '@modelcontextprotocol/server';

import { AUTH_SCOPES } from '../../src/auth/auth.constants';
import { MCP_SERVER } from '../../src/mcp/mcp.constants';
import { McpTool } from '../../src/mcp/mcp-tool.decorator';
import { McpToolDiscoveryService } from '../../src/mcp/mcp-tool-discovery.service';

type RegisteredToolCall = { name: string; config: { description: string; inputSchema?: unknown }; handler: ToolHandler };
type ToolHandler = (args: unknown, ctx: ServerContext) => Promise<CallToolResult>;

@Injectable()
class DummyMcpTool {
  @McpTool({ name: 'open_tool', description: 'No scope required' })
  async openTool(args: unknown, _ctx: ServerContext): Promise<CallToolResult> {
    return { content: [{ type: 'text', text: JSON.stringify(args) }] };
  }

  @McpTool({ name: 'guarded_tool', description: 'Requires approve_actions', requiredScopes: [AUTH_SCOPES.APPROVE_ACTIONS] })
  async guardedTool(): Promise<CallToolResult> {
    return { content: [{ type: 'text', text: 'guarded ran' }] };
  }

  untaggedMethod() { }
}

const buildCtx = (scopes: string[] = []): ServerContext =>
  ({ http: { authInfo: { token: 't', clientId: 'c', scopes, extra: {} } } }) as unknown as ServerContext;

describe('McpToolDiscoveryService', () => {
  let module: TestingModule;
  let registeredTools: Record<string, RegisteredToolCall>;
  let mockMcpServer: { registerTool: jest.Mock; toolInputSchemaJson: jest.Mock; server: { setRequestHandler: jest.Mock } };
  let toolsListHandler: (request: unknown, ctx: ServerContext) => Promise<{ tools: unknown[] }>;

  beforeAll(async () => {
    registeredTools = {};
    mockMcpServer = {
      registerTool: jest.fn((name: string, config, handler: ToolHandler) => {
        registeredTools[name] = { name, config, handler };
      }),
      toolInputSchemaJson: jest.fn(() => ({ type: 'object', properties: { query: { type: 'string' } } })),
      server: {
        setRequestHandler: jest.fn((_method, handler) => {
          toolsListHandler = handler;
        }),
      },
    };

    module = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [McpToolDiscoveryService, DummyMcpTool, { provide: MCP_SERVER, useValue: mockMcpServer }],
    }).compile();

    await module.init();
  });

  afterAll(() => module.close());

  describe('Given a provider with two @McpTool-decorated methods and one plain method', () => {
    describe('When the discovery service scans providers on module init', () => {
      test('Then it registers exactly the two decorated tools, by name', () => {
        expect(Object.keys(registeredTools).sort()).toEqual(['guarded_tool', 'open_tool']);
      });
    });
  });

  describe('Given a registered tool', () => {
    describe('When registerTool is called for it', () => {
      test('Then the description from its @McpTool metadata is passed through', () => {
        const openTool = registeredTools['open_tool'];

        expect(openTool.config.description).toBe('No scope required');
      });
    });
  });

  describe('Given a tool with no requiredScopes', () => {
    describe('When its handler is invoked with no scopes at all', () => {
      test('Then it still runs, since there is nothing to check against', async () => {
        const openTool = registeredTools['open_tool'];

        const result = await openTool.handler({ q: 1 }, buildCtx([]));

        expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify({ q: 1 }) }] });
      });
    });
  });

  describe('Given a tool that requires the approve_actions scope', () => {
    describe('When called by a caller without that scope', () => {
      test('Then it returns an isError CallToolResult naming the missing scope, without running the real handler', async () => {
        const guardedTool = registeredTools['guarded_tool'];

        const result = await guardedTool.handler(undefined, buildCtx([AUTH_SCOPES.MCP]));

        expect(result).toEqual({
          content: [{ type: 'text', text: `Forbidden: tool "guarded_tool" requires scope(s): ${AUTH_SCOPES.APPROVE_ACTIONS}` }],
          isError: true,
        });
      });
    });

    describe('When called by a caller with that scope', () => {
      test('Then it runs the real handler', async () => {
        const guardedTool = registeredTools['guarded_tool'];

        const result = await guardedTool.handler(undefined, buildCtx([AUTH_SCOPES.APPROVE_ACTIONS]));

        expect(result).toEqual({ content: [{ type: 'text', text: 'guarded ran' }] });
      });
    });

    describe('When called with no authInfo on the context at all', () => {
      test('Then it is treated as having no scopes and is refused', async () => {
        const guardedTool = registeredTools['guarded_tool'];

        const result = await guardedTool.handler(undefined, {} as ServerContext);

        expect(result).toEqual({
          content: [{ type: 'text', text: `Forbidden: tool "guarded_tool" requires scope(s): ${AUTH_SCOPES.APPROVE_ACTIONS}` }],
          isError: true,
        });
      });
    });
  });

  describe('Given the tools/list handler installed on the underlying server', () => {
    describe('When called by a caller with no scopes', () => {
      test('Then it returns only the tool that requires no scopes', async () => {
        const result = await toolsListHandler({}, buildCtx([]));

        expect(result.tools).toEqual([
          { name: 'open_tool', description: 'No scope required', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
        ]);
      });
    });

    describe('When called by a caller holding approve_actions', () => {
      test('Then it returns both tools, by name', async () => {
        const result = await toolsListHandler({}, buildCtx([AUTH_SCOPES.APPROVE_ACTIONS]));

        const names = (result.tools as { name: string }[]).map((t) => t.name).sort();
        expect(names).toEqual(['guarded_tool', 'open_tool']);
      });
    });

    describe('When building each listed tool', () => {
      test('Then it sources the inputSchema from McpServer.toolInputSchemaJson for that tool name', async () => {
        await toolsListHandler({}, buildCtx([AUTH_SCOPES.APPROVE_ACTIONS]));

        expect(mockMcpServer.toolInputSchemaJson).toHaveBeenCalledWith('open_tool');
        expect(mockMcpServer.toolInputSchemaJson).toHaveBeenCalledWith('guarded_tool');
      });
    });
  });
});
