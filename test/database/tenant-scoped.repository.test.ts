import { randomUUID, type UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { TenantContextService } from '../../src/auth/tenant-context.service';
import { DRIZZLE_DB } from '../../src/database/database.constants';
import type { DrizzleDb } from '../../src/database/database.module';
import { DrizzleTransactionContext } from '../../src/database/drizzle-transaction.context';
import { TenantScopedRepository } from '../../src/database/tenant-scoped.repository';
import { kbArticlesTable } from '../../src/schema/kb-articles.schema';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';
import { MOCK_TENANT_ID } from '../__mocks__';
import { AssertUtils } from '../utils/assert.utils';

@Injectable()
class TestKbArticleRepository extends TenantScopedRepository<typeof kbArticlesTable> {
  protected readonly table = kbArticlesTable;

  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDb,
    txContext: DrizzleTransactionContext,
    tenantContext: TenantContextService,
  ) {
    super(db, txContext, tenantContext);
  }
}

describe('TenantScopedRepository IT', () => {
  let sut: TestKbArticleRepository;
  const env = new DrizzleTestEnvironment();

  beforeAll(async () => {
    await env.start([TestKbArticleRepository]);
    sut = env.module.get(TestKbArticleRepository);
  }, 60_000);

  afterAll(async () => {
    await env.stop();
  });

  afterEach(async () => {
    await env.db.delete(kbArticlesTable);
  });

  const seedInsert = (tenantId: UUID, overrides: { title?: string } = {}) =>
    env.withTenant(tenantId, () =>
      sut.insert({
        id: randomUUID(),
        title: overrides.title ?? 'Payment webhook idempotency',
        sourceType: 'kb_article',
        rawContent: 'Webhooks must be processed idempotently.',
      }),
    );

  describe('Given insert is called inside a tenant context', () => {
    describe('When the row is persisted', () => {
      test('Then it is automatically stamped with the current tenantId, without the caller passing one', async () => {
        const result = await seedInsert(MOCK_TENANT_ID);

        expect(result.tenantId).toBe(MOCK_TENANT_ID);
      });
    });
  });

  describe('Given a row belonging to the current tenant', () => {
    describe('When findById is called for it inside that same tenant context', () => {
      test('Then it is returned', async () => {
        const inserted = await seedInsert(MOCK_TENANT_ID);

        const result = await env.withTenant(MOCK_TENANT_ID, () => sut.findById(inserted.id));

        expect(result).toEqual(inserted);
      });
    });
  });

  describe('Given a row belonging to a different tenant', () => {
    describe('When findById is called for it from another tenant context', () => {
      test('Then it returns undefined, the base class automatically filters by tenant', async () => {
        const inserted = await seedInsert(MOCK_TENANT_ID);
        const otherTenantId = randomUUID();

        const result = await env.withTenant(otherTenantId, () => sut.findById(inserted.id));

        expect(result).toBeUndefined();
      });
    });
  });

  describe('Given findById is called outside of any tenant context', () => {
    describe('When invoked', () => {
      test('Then it throws, TenantContextService.getTenantId() refuses to run unscoped', async () => {
        const inserted = await seedInsert(MOCK_TENANT_ID);

        await AssertUtils.assertError(
          async () => sut.findById(inserted.id),
          'TenantContextService.getTenantId() called outside of a tenant-scoped request',
        );
      });
    });
  });
});
