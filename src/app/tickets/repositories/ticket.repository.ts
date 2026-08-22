import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { TenantContextService } from '../../../auth/tenant-context.service';
import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import { TenantScopedRepository } from '../../../database/tenant-scoped.repository';
import { ticketsTable } from '../../../schema/tickets.schema';
import type { DynamicTicket } from '../ticket.types';

@Injectable()
export class TicketRepository extends TenantScopedRepository<typeof ticketsTable> {
  protected readonly table = ticketsTable;

  constructor(@Inject(DRIZZLE_DB) db: DrizzleDb, txContext: DrizzleTransactionContext, tenantContext: TenantContextService) {
    super(db, txContext, tenantContext);
  }

  // Overridden (not inherited): needs relations support the generic base findById can't express.
  async findById<R extends { attachments?: boolean }>(
    id: UUID,
    relations?: R
  ): Promise<DynamicTicket<R> | undefined> {
    const withQuery = relations?.attachments ? { attachments: true as const } : undefined;

    return this.getClient().query.ticketsTable.findFirst({
      where: this.withTenant(eq(ticketsTable.id, id)),
      ...(withQuery && { with: withQuery }),
    }) as Promise<DynamicTicket<R> | undefined>;
  }
}
