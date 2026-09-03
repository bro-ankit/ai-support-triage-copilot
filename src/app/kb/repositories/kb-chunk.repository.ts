import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { inArray, isNotNull, sql } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TenantContextService } from '../../../auth/tenant-context.service';
import { DRIZZLE_DB } from '../../../database/database.constants';
import type { DrizzleDb } from '../../../database/database.module';
import { DrizzleTransactionContext } from '../../../database/drizzle-transaction.context';
import { TenantScopedRepository } from '../../../database/tenant-scoped.repository';
import { type KbChunkSelect, kbChunksTable } from '../../../schema/kb-chunks.schema';
import { KB_CHUNK_REPOSITORY_DEFAULTS } from './kb-chunk.constants';
import type { KbChunkToInsert } from './kb-chunk.types';

@Injectable()
export class KbChunkRepository extends TenantScopedRepository<typeof kbChunksTable> {
  protected readonly table = kbChunksTable;

  constructor(
    @InjectPinoLogger(KbChunkRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) db: DrizzleDb,
    txContext: DrizzleTransactionContext,
    tenantContext: TenantContextService,
  ) {
    super(db, txContext, tenantContext);
  }

  async insertMany(chunks: Omit<KbChunkToInsert, 'tenantId'>[]): Promise<void> {
    if (chunks.length === 0) return;
    this.logger.debug({ count: chunks.length }, 'Inserting KB chunks');
    const client = this.getClient();

    for (let i = 0; i < chunks.length; i += KB_CHUNK_REPOSITORY_DEFAULTS.INSERT_BATCH_SIZE) {
      const batch = chunks.slice(i, i + KB_CHUNK_REPOSITORY_DEFAULTS.INSERT_BATCH_SIZE);
      await client.insert(kbChunksTable).values(
        batch.map((chunk) => ({
          ...this.stampTenant(chunk),
          contentTsv: sql`to_tsvector('english', ${chunk.content})`,
        })),
      );
    }
  }

  async findSimilarIds(embedding: number[], limit: number, maxDistance: number): Promise<UUID[]> {
    const client = this.getClient();
    const vector = `[${embedding.join(',')}]`;
    const distanceExpr = sql<number>`${kbChunksTable.embedding} <=> ${vector}::vector`;
    const rows = await client
      .select({ id: kbChunksTable.id })
      .from(kbChunksTable)
      .where(this.withTenant(isNotNull(kbChunksTable.embedding), sql`${distanceExpr} <= ${maxDistance}`))
      .orderBy(distanceExpr)
      .limit(limit);
    return rows.map((r) => r.id);
  }

  async findByLexical(query: string, limit: number): Promise<UUID[]> {
    const client = this.getClient();
    const rows = await client
      .select({ id: kbChunksTable.id })
      .from(kbChunksTable)
      .where(
        this.withTenant(
          isNotNull(kbChunksTable.contentTsv),
          sql`${kbChunksTable.contentTsv} @@ plainto_tsquery('english', ${query})`,
        ),
      )
      .orderBy(sql`ts_rank(${kbChunksTable.contentTsv}, plainto_tsquery('english', ${query})) DESC`)
      .limit(limit);
    return rows.map((r) => r.id);
  }

  async findByIds(ids: UUID[]): Promise<KbChunkSelect[]> {
    if (ids.length === 0) return [];
    const client = this.getClient();
    return client
      .select()
      .from(kbChunksTable)
      .where(this.withTenant(inArray(kbChunksTable.id, ids)));
  }
}
