import { TestBed } from '@automock/jest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AUTH_SCOPES, type AuthScope } from '../../../src/auth/auth.constants';
import { ScopesGuard } from '../../../src/auth/guards/scopes.guard';
import { AuthMocks } from '../../__mocks__/auth/auth-mocks';
import { AssertUtils } from '../../utils/assert.utils';

const buildContext = (scopes: AuthScope[]): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user: AuthMocks.buildMockUser({ scopes }) }),
    }),
    getHandler: () => jest.fn(),
  }) as unknown as ExecutionContext;

describe('ScopesGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let sut: ScopesGuard;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ScopesGuard).compile();

    sut = unit;
    reflector = unitRef.get(Reflector);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given no required scopes are declared on the handler', () => {
    describe('When canActivate is called', () => {
      test('Then it allows the request through', () => {
        reflector.get.mockReturnValue(undefined);

        expect(sut.canActivate(buildContext([]))).toBe(true);
      });
    });
  });

  describe('Given the handler requires a scope the caller holds', () => {
    describe('When canActivate is called', () => {
      test('Then it allows the request through', () => {
        reflector.get.mockReturnValue([AUTH_SCOPES.MCP]);

        expect(sut.canActivate(buildContext([AUTH_SCOPES.MCP, AUTH_SCOPES.APPROVE_ACTIONS]))).toBe(true);
      });
    });
  });

  describe('Given the handler requires a scope the caller does not hold', () => {
    describe('When canActivate is called', () => {
      test('Then it throws ForbiddenException naming the missing scope', async () => {
        reflector.get.mockReturnValue([AUTH_SCOPES.APPROVE_ACTIONS]);

        await AssertUtils.assertError(
          async () => sut.canActivate(buildContext([AUTH_SCOPES.MCP])),
          `This action requires scope(s): ${AUTH_SCOPES.APPROVE_ACTIONS}`,
          403,
        );
      });
    });
  });

  describe('Given the handler requires multiple scopes and the caller holds only some of them', () => {
    describe('When canActivate is called', () => {
      test('Then it throws ForbiddenException naming both required scopes', async () => {
        reflector.get.mockReturnValue([AUTH_SCOPES.MCP, AUTH_SCOPES.APPROVE_ACTIONS]);

        await AssertUtils.assertError(
          async () => sut.canActivate(buildContext([AUTH_SCOPES.MCP])),
          `This action requires scope(s): ${AUTH_SCOPES.MCP}, ${AUTH_SCOPES.APPROVE_ACTIONS}`,
          403,
        );
      });
    });
  });
});
