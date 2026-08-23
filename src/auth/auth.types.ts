import type { UUID } from 'node:crypto';

export type AuthenticatedUser = {
  userId: string;
  tenantId: UUID;
  scopes: string[];
};
