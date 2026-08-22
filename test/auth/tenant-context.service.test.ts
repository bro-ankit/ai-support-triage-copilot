import { randomUUID } from 'node:crypto';

import { TenantContextService } from '../../src/auth/tenant-context.service';
import { AssertUtils } from '../utils/assert.utils';

describe('TenantContextService', () => {
  let sut: TenantContextService;

  beforeEach(() => {
    sut = new TenantContextService();
  });

  describe('Given getTenantId is called outside of any run() scope', () => {
    describe('When invoked', () => {
      test('Then it throws, since there is no tenant context established', async () => {
        await AssertUtils.assertError(
          async () => sut.getTenantId(),
          'TenantContextService.getTenantId() called outside of a tenant-scoped request',
        );
      });
    });
  });

  describe('Given run() is called with a tenantId', () => {
    describe('When getTenantId is called synchronously inside the callback', () => {
      test('Then it returns that tenantId', () => {
        const tenantId = randomUUID();

        const result = sut.run(tenantId, () => sut.getTenantId());

        expect(result).toBe(tenantId);
      });
    });

    describe('When getTenantId is called after an await inside the callback', () => {
      test('Then it still returns that tenantId, since AsyncLocalStorage propagates across awaits', async () => {
        const tenantId = randomUUID();

        const result = await sut.run(tenantId, async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return sut.getTenantId();
        });

        expect(result).toBe(tenantId);
      });
    });
  });

  describe('Given two nested run() calls with different tenantIds', () => {
    describe('When getTenantId is called inside the inner scope', () => {
      test('Then it returns the inner tenantId, not the outer one', () => {
        const outerTenantId = randomUUID();
        const innerTenantId = randomUUID();

        const result = sut.run(outerTenantId, () => sut.run(innerTenantId, () => sut.getTenantId()));

        expect(result).toBe(innerTenantId);
      });
    });
  });

  describe('Given a run() scope has already returned', () => {
    describe('When getTenantId is called afterwards, outside any scope', () => {
      test('Then it throws, the context does not leak past the run() call', async () => {
        const tenantId = randomUUID();
        sut.run(tenantId, () => sut.getTenantId());

        await AssertUtils.assertError(
          async () => sut.getTenantId(),
          'TenantContextService.getTenantId() called outside of a tenant-scoped request',
        );
      });
    });
  });
});
