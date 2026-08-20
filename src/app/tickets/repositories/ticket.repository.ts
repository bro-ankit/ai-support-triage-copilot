import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import { type TicketInsert, type TicketSelect, ticketsTable } from '../../../schema/tickets.schema';

@Injectable()
export class TicketRepository {
  constructor(
    @InjectPinoLogger(TicketRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async insert(data: TicketInsert): Promise<TicketSelect> {
    this.logger.debug({ subject: data.subject }, 'Inserting ticket');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(ticketsTable).values(data).returning();
    return result;
  }

  async findById(id: UUID): Promise<TicketSelect | undefined> {
    const client = this.txContext.getClient(this.db);
    const [result] = await client.select().from(ticketsTable).where(eq(ticketsTable.id, id)).limit(1);
    return result;
  }
}
