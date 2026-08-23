import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { AUTH_SCOPES } from '../../../src/auth/auth.constants';
import { RequireAuth } from '../../../src/auth/decorators/require-auth.decorator';
import { REQUIRED_SCOPES_KEY } from '../../../src/auth/decorators/require-scopes.decorator';
import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';
import { ScopesGuard } from '../../../src/auth/guards/scopes.guard';

describe('RequireAuth decorator', () => {
  describe('Given a method decorated with @RequireAuth(mcp)', () => {
    describe('When its metadata is read back via Reflector', () => {
      test('Then it applies JwtAuthGuard and ScopesGuard, and records the mcp scope', () => {
        class Dummy {
          @RequireAuth(AUTH_SCOPES.MCP)
          doThing() {}
        }

        const guards = new Reflector().get(GUARDS_METADATA, Dummy.prototype.doThing);
        const scopes = new Reflector().get(REQUIRED_SCOPES_KEY, Dummy.prototype.doThing);

        expect(guards).toEqual([JwtAuthGuard, ScopesGuard]);
        expect(scopes).toEqual([AUTH_SCOPES.MCP]);
      });
    });
  });

  describe('Given a method decorated with @RequireAuth() and no scopes', () => {
    describe('When its metadata is read back via Reflector', () => {
      test('Then it still applies both guards, with an empty required-scopes list', () => {
        class Dummy {
          @RequireAuth()
          doThing() {}
        }

        const guards = new Reflector().get(GUARDS_METADATA, Dummy.prototype.doThing);
        const scopes = new Reflector().get(REQUIRED_SCOPES_KEY, Dummy.prototype.doThing);

        expect(guards).toEqual([JwtAuthGuard, ScopesGuard]);
        expect(scopes).toEqual([]);
      });
    });
  });
});
