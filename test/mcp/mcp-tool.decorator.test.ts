import { Reflector } from '@nestjs/core';
import { z } from 'zod';

import { MCP_TOOL_KEY, McpTool, type McpToolMetadata } from '../../src/mcp/mcp-tool.decorator';
import { AUTH_SCOPES } from '../../src/auth/auth.constants';

describe('McpTool decorator', () => {
  describe('Given a method decorated with @McpTool', () => {
    describe('When its metadata is read back via Reflector', () => {
      test('Then it exposes the exact metadata object passed to the decorator', () => {
        const metadata: McpToolMetadata = {
          name: 'do_thing',
          description: 'Does a thing',
          inputSchema: { query: z.string() },
          requiredScopes: [AUTH_SCOPES.MCP],
        };

        class Dummy {
          @McpTool(metadata)
          doThing() {}
        }

        const reflector = new Reflector();
        const result = reflector.get<McpToolMetadata>(MCP_TOOL_KEY, Dummy.prototype.doThing);

        expect(result).toEqual(metadata);
      });
    });
  });

  describe('Given a method with no @McpTool decorator', () => {
    describe('When its metadata is read back via Reflector', () => {
      test('Then it returns undefined', () => {
        class Dummy {
          plainMethod() {}
        }

        const reflector = new Reflector();
        const result = reflector.get<McpToolMetadata>(MCP_TOOL_KEY, Dummy.prototype.plainMethod);

        expect(result).toBeUndefined();
      });
    });
  });
});
