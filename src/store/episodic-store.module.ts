import { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';

import { AI_CLIENT } from '../ai/ai.constants';
import type { IAiClient } from '../ai/ai.interface';
import { EMBEDDING_DIMENSIONS } from '../ai/gemini/gemini.constants';
import { ENV_VARIABLES } from '../constants/env.constants';
import { AdvisoryLockKeyUtil } from '../database/advisory-lock-key.util';
import { EPISODIC_STORE, EPISODIC_STORE_DEFAULTS } from './episodic-store.constants';

const SETUP_LOCK_KEY = AdvisoryLockKeyUtil.fromName('ai-support-triage-copilot:episodic-store-setup');

@Global()
@Module({
  providers: [
    {
      provide: EPISODIC_STORE,
      inject: [ConfigService, AI_CLIENT],
      useFactory: async (config: ConfigService, aiClient: IAiClient): Promise<PostgresStore> => {
        const host = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.host);
        const port = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.port);
        const user = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.user);
        const password = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.password);
        const database = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.database);
        const connString = `postgresql://${user}:${password}@${host}:${port}/${database}`;

        const store = PostgresStore.fromConnString(connString, {
          schema: EPISODIC_STORE_DEFAULTS.SCHEMA,
          index: {
            dims: EMBEDDING_DIMENSIONS,
            embed: (texts: string[]) => Promise.all(texts.map((text) => aiClient.generateEmbedding(text))),
            fields: ['text'],
          },
        });

        const lockClient = new Client({ host, port: Number(port), user, password, database });
        await lockClient.connect();
        try {
          await lockClient.query('SELECT pg_advisory_lock($1, $2)', SETUP_LOCK_KEY);
          await store.setup();
        } finally {
          await lockClient.query('SELECT pg_advisory_unlock($1, $2)', SETUP_LOCK_KEY);
          await lockClient.end();
        }

        return store;
      },
    },
  ],
  exports: [EPISODIC_STORE],
})
export class EpisodicStoreModule {}
