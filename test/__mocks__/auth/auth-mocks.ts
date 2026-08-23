import jwt from 'jsonwebtoken';

import type { AuthenticatedUser } from '../../../src/auth/auth.types';
import { MOCK_TENANT_ID } from '../mock-tenant-id';

export const MOCK_JWT_SECRET = 'test-only-symmetric-secret';

export class AuthMocks {
  static buildMockUser(args: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
    return {
      userId: 'test-user-id',
      tenantId: MOCK_TENANT_ID,
      scopes: [],
      ...args,
    };
  }

  static createMockToken(user: AuthenticatedUser = AuthMocks.buildMockUser()): string {
    return jwt.sign(user, MOCK_JWT_SECRET, { algorithm: 'HS256' });
  }
}
