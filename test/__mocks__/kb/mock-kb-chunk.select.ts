import { randomUUID } from 'node:crypto';

import type { KbChunkSelect } from '../../../src/schema/kb-chunks.schema';
import { MOCK_TENANT_ID } from '../mock-tenant-id';

export const mockKbChunkSelect = (args: Partial<KbChunkSelect> = {}): KbChunkSelect => ({
  id: randomUUID(),
  tenantId: MOCK_TENANT_ID,
  articleId: randomUUID(),
  chunkIndex: 0,
  content: 'Webhook retries must be idempotent.',
  tokenCount: 10,
  embedding: [0.1, 0.2, 0.3],
  contentTsv: null,
  createdAt: new Date(),
  ...args,
});
