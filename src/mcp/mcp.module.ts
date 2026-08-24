import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { McpServer } from '@modelcontextprotocol/server';

import { KbModule } from '../app/kb/kb.module';
import { McpBearerAuthMiddleware } from './mcp-bearer-auth.middleware';
import { McpToolDiscoveryService } from './mcp-tool-discovery.service';
import { MCP_SERVER, MCP_SERVER_INFO } from './mcp.constants';
import { McpController } from './mcp.controller';
import { KbSearchMcpTool } from './tools/kb-search-mcp.tool';

@Module({
  imports: [DiscoveryModule, KbModule],
  controllers: [McpController],
  providers: [
    {
      provide: MCP_SERVER,
      useFactory: () => new McpServer(MCP_SERVER_INFO),
    },
    McpToolDiscoveryService,
    KbSearchMcpTool],
})
export class McpModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(McpBearerAuthMiddleware).forRoutes({ path: 'mcp', method: RequestMethod.POST });
  }
}
