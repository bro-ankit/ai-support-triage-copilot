import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import type { ExecutionContext } from '@nestjs/common';

import { CurrentAuth } from '../../../src/auth/decorators/current-auth.decorator';
import { AuthMocks } from '../../__mocks__/auth/auth-mocks';

// Standard NestJS technique for unit-testing a createParamDecorator factory directly: apply it to
// a throwaway method, then pull the raw factory function back out of the route-args metadata Nest
// stores it under, since the decorator itself is only ever meant to be applied, not called.
const extractParamDecoratorFactory = (decorator: ParameterDecorator): ((data: unknown, ctx: ExecutionContext) => unknown) => {
  class TestClass {
    testMethod(@decorator _value: unknown) {}
  }

  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'testMethod');
  return args[Object.keys(args)[0]].factory;
};

const buildContext = (request: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('CurrentAuth decorator', () => {
  describe('Given a request with an authenticated user attached by JwtAuthGuard', () => {
    describe('When the parameter factory is invoked', () => {
      test('Then it returns request.user', () => {
        const factory = extractParamDecoratorFactory(CurrentAuth());
        const user = AuthMocks.buildMockUser({ scopes: ['mcp'] });

        const result = factory(undefined, buildContext({ user }));

        expect(result).toBe(user);
      });
    });
  });
});
