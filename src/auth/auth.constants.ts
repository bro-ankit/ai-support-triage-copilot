export const AUTH_SCOPES = {
  MCP: 'mcp',
  APPROVE_ACTIONS: 'approve_actions',
} as const;

export type AuthScope = (typeof AUTH_SCOPES)[keyof typeof AUTH_SCOPES];
