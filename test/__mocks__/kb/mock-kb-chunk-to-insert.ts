import { randomUUID } from 'node:crypto';

import { EMBEDDING_DIMENSIONS } from '../../../src/ai/gemini/gemini.constants';
import type { KbChunkToInsert } from '../../../src/app/kb/repositories/kb-chunk.types';
import { MOCK_TENANT_ID } from '../mock-tenant-id';

export const mockKbChunkToInsert = (args: Partial<KbChunkToInsert> = {}): KbChunkToInsert => ({
  id: randomUUID(),
  tenantId: MOCK_TENANT_ID,
  articleId: randomUUID(),
  chunkIndex: 0,
  content: 'Webhook retries must be idempotent.',
  tokenCount: 10,
  embedding: new Array(EMBEDDING_DIMENSIONS).fill(0.1),
  ...args,
});
