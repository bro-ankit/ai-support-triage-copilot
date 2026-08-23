import { randomUUID } from 'node:crypto';

import type { AuthorizedUserSelect } from '../../../src/schema/authorized-users.schema';
import { MOCK_TENANT_ID } from '../mock-tenant-id';

export const mockAuthorizedUserSelect = (args: Partial<AuthorizedUserSelect> = {}): AuthorizedUserSelect => ({
  id: randomUUID(),
  sub: 'auth0|test-user-id',
  tenantId: MOCK_TENANT_ID,
  scopes: [],
  createdAt: new Date(),
  ...args,
});
