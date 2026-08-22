import jwt from 'jsonwebtoken';

import type { AuthenticatedClient } from '../../../src/auth/auth.types';
import { MOCK_TENANT_ID } from '../mock-tenant-id';

export const MOCK_JWT_SECRET = 'test-only-symmetric-secret';

export class AuthMocks {
  static buildMockClient(args: Partial<AuthenticatedClient> = {}): AuthenticatedClient {
    return {
      clientId: 'test-client-id',
      tenantId: MOCK_TENANT_ID,
      scopes: [],
      ...args,
    };
  }

  static createMockToken(client: AuthenticatedClient = AuthMocks.buildMockClient()): string {
    return jwt.sign(client, MOCK_JWT_SECRET, { algorithm: 'HS256' });
  }
}
