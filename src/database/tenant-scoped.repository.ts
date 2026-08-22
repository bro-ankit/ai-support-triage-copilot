import { and, eq, type Column, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

import { TenantContextService } from '../auth/tenant-context.service';
import type { DrizzleDb } from './database.module';
import { DrizzleTransactionContext } from './drizzle-transaction.context';

export abstract class TenantScopedRepository<TTable extends PgTable & { id: Column; tenantId: Column }> {
  protected abstract readonly table: TTable;

  constructor(
    protected readonly db: DrizzleDb,
    protected readonly txContext: DrizzleTransactionContext,
    protected readonly tenantContext: TenantContextService,
  ) { }

  async insert(data: Omit<TTable['$inferInsert'], 'tenantId'>): Promise<TTable['$inferSelect']> {
    const client = this.getClient();
    const [result] = await client
      .insert(this.table)
      .values(this.stampTenant(data) as never)
      .returning();

    return result;
  }

  async findById(id: TTable['$inferSelect']['id']): Promise<TTable['$inferSelect'] | undefined> {
    const client = this.getClient();
    const [result] = await client
      .select()
      .from(this.table as PgTable)
      .where(this.withTenant(eq(this.table.id, id)))
      .limit(1);
    return result as TTable['$inferSelect'] | undefined;
  }

  protected getClient() {
    return this.txContext.getClient(this.db);
  }

  protected withTenant(...conditions: (SQL | undefined)[]): SQL | undefined {
    return and(eq(this.table.tenantId, this.tenantContext.getTenantId()), ...conditions);
  }

  protected stampTenant<T extends object>(data: T): T & { tenantId: string } {
    return { ...data, tenantId: this.tenantContext.getTenantId() };
  }

}
