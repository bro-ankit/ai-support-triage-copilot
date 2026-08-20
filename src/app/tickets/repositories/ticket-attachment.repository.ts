import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import {
  type TicketAttachmentInsert,
  type TicketAttachmentProcessingStatus,
  type TicketAttachmentSelect,
  ticketAttachmentsTable,
} from '../../../schema/ticket-attachments.schema';

@Injectable()
export class TicketAttachmentRepository {
  constructor(
    @InjectPinoLogger(TicketAttachmentRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async insert(data: TicketAttachmentInsert): Promise<TicketAttachmentSelect> {
    this.logger.debug({ ticketId: data.ticketId, kind: data.kind }, 'Inserting ticket attachment');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(ticketAttachmentsTable).values(data).returning();
    return result;
  }

  async findById(id: UUID): Promise<TicketAttachmentSelect | undefined> {
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .select()
      .from(ticketAttachmentsTable)
      .where(eq(ticketAttachmentsTable.id, id))
      .limit(1);
    return result;
  }

  async findByTicketId(ticketId: UUID): Promise<TicketAttachmentSelect[]> {
    const client = this.txContext.getClient(this.db);
    return client.select().from(ticketAttachmentsTable).where(eq(ticketAttachmentsTable.ticketId, ticketId));
  }

  async updateProcessingResult(
    id: UUID,
    data: { processingStatus: TicketAttachmentProcessingStatus; extractedText?: string; processingError?: string },
  ): Promise<TicketAttachmentSelect> {
    this.logger.debug({ id, status: data.processingStatus }, 'Updating ticket attachment processing result');
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .update(ticketAttachmentsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ticketAttachmentsTable.id, id))
      .returning();
    return result;
  }
}
