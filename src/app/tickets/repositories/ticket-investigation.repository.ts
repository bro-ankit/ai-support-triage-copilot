import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TenantContextService } from '../../../auth/tenant-context.service';
import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import {
  type TicketInvestigationInsert,
  type TicketInvestigationSelect,
  ticketInvestigationsTable,
} from '../../../schema/ticket-investigations.schema';
import { ticketsTable } from '../../../schema/tickets.schema';
import { VectorTypeUtil } from '../../../schema/vector.util';
import type { SimilarPastCase } from '../memory/episodic-memory.types';

@Injectable()
export class TicketInvestigationRepository {
  constructor(
    @InjectPinoLogger(TicketInvestigationRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
    private readonly tenantContext: TenantContextService,
  ) {}

  async insert(data: Omit<TicketInvestigationInsert, 'tenantId'>): Promise<TicketInvestigationSelect> {
    this.logger.debug({ ticketId: data.ticketId, status: data.status }, 'Inserting ticket investigation');
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .insert(ticketInvestigationsTable)
      .values({ ...data, tenantId: this.tenantContext.getTenantId() })
      .returning();
    return result;
  }

  async findByTicketId(ticketId: UUID): Promise<TicketInvestigationSelect | undefined> {
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .select()
      .from(ticketInvestigationsTable)
      .where(eq(ticketInvestigationsTable.ticketId, ticketId))
      .limit(1);
    return result;
  }

  async findById(id: UUID): Promise<TicketInvestigationSelect | undefined> {
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .select()
      .from(ticketInvestigationsTable)
      .where(eq(ticketInvestigationsTable.id, id))
      .limit(1);
    return result;
  }

  async updateStatus(id: UUID, status: TicketInvestigationSelect['status']): Promise<TicketInvestigationSelect> {
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .update(ticketInvestigationsTable)
      .set({ status })
      .where(eq(ticketInvestigationsTable.id, id))
      .returning();
    return result;
  }

  async findSimilarCases(
    embedding: number[],
    excludeTicketId: UUID,
    limit: number,
    maxDistance: number,
  ): Promise<SimilarPastCase[]> {
    const client = this.txContext.getClient(this.db);
    const vector = VectorTypeUtil.toDriverString(embedding);
    const distanceExpr = sql<number>`${ticketInvestigationsTable.episodeEmbedding} <=> ${vector}::vector`;

    const rows = await client
      .select({
        ticketId: ticketInvestigationsTable.ticketId,
        subject: ticketsTable.subject,
        description: ticketsTable.description,
        diagnosis: ticketInvestigationsTable.diagnosis,
        proposedAction: ticketInvestigationsTable.proposedAction,
        distance: distanceExpr,
      })
      .from(ticketInvestigationsTable)
      .innerJoin(ticketsTable, eq(ticketInvestigationsTable.ticketId, ticketsTable.id))
      .where(
        and(
          eq(ticketInvestigationsTable.tenantId, this.tenantContext.getTenantId()),
          isNotNull(ticketInvestigationsTable.episodeEmbedding),
          ne(ticketInvestigationsTable.ticketId, excludeTicketId),
          sql`${distanceExpr} <= ${maxDistance}`,
        ),
      )
      .orderBy(distanceExpr)
      .limit(limit);

    return rows;
  }
}
