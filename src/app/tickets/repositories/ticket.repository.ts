import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import { type TicketInsert, type TicketSelect, ticketsTable } from '../../../schema/tickets.schema';
import type { DynamicTicket } from '../ticket.types';

@Injectable()
export class TicketRepository {
  constructor(
    @InjectPinoLogger(TicketRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) { }

  async insert(data: TicketInsert): Promise<TicketSelect> {
    this.logger.debug({ subject: data.subject }, 'Inserting ticket');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(ticketsTable).values(data).returning();
    return result;
  }

  async findById<R extends { attachments?: boolean }>(
    id: UUID,
    relations?: R
  ): Promise<DynamicTicket<R> | undefined> {
    const client = this.txContext.getClient(this.db);

    const withQuery = relations?.attachments ? { attachments: true as const } : undefined;

    return client.query.ticketsTable.findFirst({
      where: eq(ticketsTable.id, id),
      ...(withQuery && { with: withQuery }),
    }) as Promise<DynamicTicket<R> | undefined>;
  }
}
