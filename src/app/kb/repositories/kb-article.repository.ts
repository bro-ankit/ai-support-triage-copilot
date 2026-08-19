import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import { type KbArticleInsert, type KbArticleSelect, kbArticlesTable } from '../../../schema/kb-articles.schema';

@Injectable()
export class KbArticleRepository {
  constructor(
    @InjectPinoLogger(KbArticleRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) { }

  async insert(data: KbArticleInsert): Promise<KbArticleSelect> {
    this.logger.debug({ title: data.title }, 'Inserting KB article');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(kbArticlesTable).values(data).returning();
    return result;
  }

  async findById(id: UUID): Promise<KbArticleSelect | undefined> {
    const client = this.txContext.getClient(this.db);
    const [result] = await client.select().from(kbArticlesTable).where(eq(kbArticlesTable.id, id)).limit(1);
    return result;
  }
}
