import { Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Request, Response } from 'express';

import { MCP_SERVER } from './mcp.constants';

@ApiTags('mcp')
@ApiBearerAuth()
@Controller()
export class McpController {
  constructor(@Inject(MCP_SERVER) private readonly mcpServer: McpServer) { }

  @Post('mcp')
  @ApiOperation({
    summary:
      'MCP JSON-RPC 2.0 transport. A single endpoint multiplexing every MCP method (initialize, ' +
      'tools/list, tools/call, ...) via the request body\'s method field, so there is no fixed ' +
      'request/response DTO to document here. Requires a bearer token with the mcp scope; per-tool ' +
      'scope requirements (see @McpTool metadata) are enforced on tools/call and reflected in ' +
      'tools/list per caller.',
  })
  async handleMcp(@Req() req: Request, @Res() res: Response): Promise<void> {
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await this.mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
