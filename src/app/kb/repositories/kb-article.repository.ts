import { Inject, Injectable } from '@nestjs/common';

import { TenantContextService } from '../../../auth/tenant-context.service';
import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import { TenantScopedRepository } from '../../../database/tenant-scoped.repository';
import { kbArticlesTable } from '../../../schema/kb-articles.schema';

@Injectable()
export class KbArticleRepository extends TenantScopedRepository<typeof kbArticlesTable> {
  protected readonly table = kbArticlesTable;

  constructor(@Inject(DRIZZLE_DB) db: DrizzleDb, txContext: DrizzleTransactionContext, tenantContext: TenantContextService) {
    super(db, txContext, tenantContext);
  }
}
