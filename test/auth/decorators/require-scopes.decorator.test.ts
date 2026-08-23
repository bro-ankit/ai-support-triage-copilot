import { Reflector } from '@nestjs/core';

import { AUTH_SCOPES } from '../../../src/auth/auth.constants';
import { REQUIRED_SCOPES_KEY, RequireScopes } from '../../../src/auth/decorators/require-scopes.decorator';

describe('RequireScopes decorator', () => {
  describe('Given a method decorated with @RequireScopes(mcp, approve_actions)', () => {
    describe('When its metadata is read back via Reflector', () => {
      test('Then it exposes exactly the scopes passed to the decorator, in order', () => {
        class Dummy {
          @RequireScopes(AUTH_SCOPES.MCP, AUTH_SCOPES.APPROVE_ACTIONS)
          doThing() {}
        }

        const result = new Reflector().get(REQUIRED_SCOPES_KEY, Dummy.prototype.doThing);

        expect(result).toEqual([AUTH_SCOPES.MCP, AUTH_SCOPES.APPROVE_ACTIONS]);
      });
    });
  });

  describe('Given a method decorated with @RequireScopes() and no scopes', () => {
    describe('When its metadata is read back via Reflector', () => {
      test('Then it exposes an empty array', () => {
        class Dummy {
          @RequireScopes()
          doThing() {}
        }

        const result = new Reflector().get(REQUIRED_SCOPES_KEY, Dummy.prototype.doThing);

        expect(result).toEqual([]);
      });
    });
  });
});
