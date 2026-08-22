import { randomUUID } from 'node:crypto';

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { TenantContextInterceptor } from '../../src/auth/tenant-context.interceptor';
import { TenantContextService } from '../../src/auth/tenant-context.service';
import { AuthMocks } from '../__mocks__/auth/auth-mocks';

const buildContext = (request: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const runIntercept = async (
  sut: TenantContextInterceptor,
  context: ExecutionContext,
  onHandle: () => void,
): Promise<void> => {
  const next: CallHandler = {
    handle: () => {
      onHandle();
      return of('result');
    },
  };

  await new Promise<void>((resolve) => {
    sut.intercept(context, next).subscribe(() => resolve());
  });
};

describe('TenantContextInterceptor', () => {
  let tenantContext: TenantContextService;
  let sut: TenantContextInterceptor;

  beforeEach(() => {
    tenantContext = new TenantContextService();
    sut = new TenantContextInterceptor(tenantContext);
  });

  describe('Given a request with request.user.tenantId (Passport/REST route)', () => {
    describe('When intercept runs the downstream handler', () => {
      test('Then the tenant context is established from request.user.tenantId for that handler', async () => {
        const user = AuthMocks.buildMockClient();
        const context = buildContext({ user });
        let seenTenantId: string | undefined;

        await runIntercept(sut, context, () => {
          seenTenantId = tenantContext.getTenantId();
        });

        expect(seenTenantId).toBe(user.tenantId);
      });
    });
  });

  describe('Given a request with request.auth.extra.tenantId (MCP bearer-auth route) and no request.user', () => {
    describe('When intercept runs the downstream handler', () => {
      test('Then the tenant context is established from request.auth.extra.tenantId', async () => {
        const tenantId = randomUUID();
        const context = buildContext({ auth: { token: 't', clientId: 'c', scopes: [], extra: { tenantId } } });
        let seenTenantId: string | undefined;

        await runIntercept(sut, context, () => {
          seenTenantId = tenantContext.getTenantId();
        });

        expect(seenTenantId).toBe(tenantId);
      });
    });
  });

  describe('Given a request with both request.user and request.auth present', () => {
    describe('When intercept runs the downstream handler', () => {
      test('Then request.user.tenantId takes precedence', async () => {
        const user = AuthMocks.buildMockClient();
        const authTenantId = randomUUID();
        const context = buildContext({
          user,
          auth: { token: 't', clientId: 'c', scopes: [], extra: { tenantId: authTenantId } },
        });
        let seenTenantId: string | undefined;

        await runIntercept(sut, context, () => {
          seenTenantId = tenantContext.getTenantId();
        });

        expect(seenTenantId).toBe(user.tenantId);
      });
    });
  });

  describe('Given a request with neither request.user nor request.auth (unauthenticated route)', () => {
    describe('When intercept runs the downstream handler', () => {
      test('Then it passes the request through without establishing any tenant context', async () => {
        const context = buildContext({});
        let threw = false;

        await runIntercept(sut, context, () => {
          try {
            tenantContext.getTenantId();
          } catch {
            threw = true;
          }
        });

        expect(threw).toBe(true);
      });
    });
  });
});
