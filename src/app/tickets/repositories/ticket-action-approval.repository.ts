import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import {
  type TicketActionApprovalInsert,
  type TicketActionApprovalSelect,
  ticketActionApprovalsTable,
} from '../../../schema/ticket-action-approvals.schema';

@Injectable()
export class TicketActionApprovalRepository {
  constructor(
    @InjectPinoLogger(TicketActionApprovalRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async insert(data: TicketActionApprovalInsert): Promise<TicketActionApprovalSelect> {
    this.logger.debug({ investigationId: data.ticketInvestigationId }, 'Inserting ticket action approval');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(ticketActionApprovalsTable).values(data).returning();
    return result;
  }

  async findLatestByInvestigationId(investigationId: UUID): Promise<TicketActionApprovalSelect | undefined> {
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .select()
      .from(ticketActionApprovalsTable)
      .where(eq(ticketActionApprovalsTable.ticketInvestigationId, investigationId))
      .orderBy(desc(ticketActionApprovalsTable.approvedAt))
      .limit(1);
    return result;
  }

  async consumeIfActive(id: UUID): Promise<TicketActionApprovalSelect | undefined> {
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .update(ticketActionApprovalsTable)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(ticketActionApprovalsTable.id, id),
          isNull(ticketActionApprovalsTable.consumedAt),
          gt(ticketActionApprovalsTable.expiresAt, sql`now()`),
        ),
      )
      .returning();
    return result;
  }
}
