import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { CallToolResult, ListToolsResult, McpServer, ServerContext, Tool } from '@modelcontextprotocol/server';

import { MCP_SERVER } from './mcp.constants';
import { MCP_TOOL_KEY, type McpToolMetadata } from './mcp-tool.decorator';

@Injectable()
export class McpToolDiscoveryService implements OnModuleInit {
  private readonly registeredTools: McpToolMetadata[] = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    @Inject(MCP_SERVER) private readonly mcpServer: McpServer,
  ) { }

  onModuleInit() {
    for (const wrapper of this.discovery.getProviders()) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') continue;

      const proto = Object.getPrototypeOf(instance);

      this.scanner.getAllMethodNames(proto).forEach((methodName) => {
        const meta = this.reflector.get<McpToolMetadata>(MCP_TOOL_KEY, proto[methodName]);
        if (!meta) return;

        const handler = (instance as Record<string, unknown>)[methodName] as (
          args: unknown,
          ctx: ServerContext,
        ) => Promise<CallToolResult>;

        this.mcpServer.registerTool(
          meta.name,
          { description: meta.description, inputSchema: meta.inputSchema as never, outputSchema: meta.outputSchema as never },
          this.withScopeCheck(meta, handler.bind(instance)) as never,
        );
        this.registeredTools.push(meta);
      });
    }

    this.mcpServer.server.setRequestHandler('tools/list', async (_request, ctx): Promise<ListToolsResult> => {
      const callerScopes = ctx.http?.authInfo?.scopes ?? [];
      const tools: Tool[] = this.registeredTools
        .filter((meta) => (meta.requiredScopes ?? []).every((scope) => callerScopes.includes(scope)))
        .map((meta) => ({
          name: meta.name,
          description: meta.description,
          inputSchema: (this.mcpServer.toolInputSchemaJson(meta.name) as Tool['inputSchema']) ?? {
            type: 'object',
            properties: {},
          },
        }));
      return { tools };
    });
  }

  private withScopeCheck(
    meta: McpToolMetadata,
    handler: (args: unknown, ctx: ServerContext) => Promise<CallToolResult>,
  ) {
    const requiredScopes = meta.requiredScopes ?? [];
    return async (args: unknown, ctx: ServerContext): Promise<CallToolResult> => {
      const callerScopes = ctx.http?.authInfo?.scopes ?? [];
      const missingScopes = requiredScopes.filter((scope) => !callerScopes.includes(scope));
      if (missingScopes.length > 0) {
        return {
          content: [{ type: 'text', text: `Forbidden: tool "${meta.name}" requires scope(s): ${missingScopes.join(', ')}` }],
          isError: true,
        };
      }
      return handler(args, ctx);
    };
  }
}
