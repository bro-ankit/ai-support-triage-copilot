import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import {
  type TicketClassificationInsert,
  type TicketClassificationSelect,
  ticketClassificationsTable,
} from '../../../schema/ticket-classifications.schema';

@Injectable()
export class TicketClassificationRepository {
  constructor(
    @InjectPinoLogger(TicketClassificationRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async insert(data: TicketClassificationInsert): Promise<TicketClassificationSelect> {
    this.logger.debug({ ticketId: data.ticketId, category: data.category }, 'Inserting ticket classification');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(ticketClassificationsTable).values(data).returning();
    return result;
  }

  async findByTicketId(ticketId: UUID): Promise<TicketClassificationSelect | undefined> {
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .select()
      .from(ticketClassificationsTable)
      .where(eq(ticketClassificationsTable.ticketId, ticketId))
      .limit(1);
    return result;
  }
}
