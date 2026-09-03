import { SetMetadata } from '@nestjs/common';
import type { z } from 'zod';

import type { AuthScope } from '../auth/auth.constants';

export const MCP_TOOL_KEY = Symbol('MCP_TOOL_KEY');

export type McpToolMetadata = {
  name: string;
  description: string;
  inputSchema?: z.ZodType;
  outputSchema?: z.ZodType;
  requiredScopes?: AuthScope[];
};

export const McpTool =
  (metadata: McpToolMetadata): MethodDecorator =>
  (target, propertyKey, descriptor: PropertyDescriptor) => {
    SetMetadata<symbol, McpToolMetadata>(MCP_TOOL_KEY, metadata)(target, propertyKey, descriptor);
    return descriptor;
  };
