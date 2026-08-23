import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { DrizzleTransactionContext } from '../database/drizzle-transaction.context';
import { authorizedUsersTable, type AuthorizedUserSelect } from '../schema/authorized-users.schema';

@Injectable()
export class AuthorizedUserRepository {
  constructor(
    @InjectPinoLogger(AuthorizedUserRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) { }

  async findBySub(sub: string): Promise<AuthorizedUserSelect | undefined> {
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .select()
      .from(authorizedUsersTable)
      .where(eq(authorizedUsersTable.sub, sub))
      .limit(1);

    if (!result) this.logger.warn({ sub }, 'No authorized user found for this token subject');
    return result;
  }
}
