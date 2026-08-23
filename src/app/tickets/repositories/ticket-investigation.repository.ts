import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import {
  type TicketInvestigationInsert,
  type TicketInvestigationSelect,
  ticketInvestigationsTable,
} from '../../../schema/ticket-investigations.schema';

@Injectable()
export class TicketInvestigationRepository {
  constructor(
    @InjectPinoLogger(TicketInvestigationRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async insert(data: TicketInvestigationInsert): Promise<TicketInvestigationSelect> {
    this.logger.debug({ ticketId: data.ticketId, status: data.status }, 'Inserting ticket investigation');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(ticketInvestigationsTable).values(data).returning();
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
}
