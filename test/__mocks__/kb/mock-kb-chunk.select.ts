import { randomUUID } from 'node:crypto';

import type { KbChunkSelect } from '../../../src/schema/kb-chunks.schema';

export const mockKbChunkSelect = (args: Partial<KbChunkSelect> = {}): KbChunkSelect => ({
  id: randomUUID(),
  articleId: randomUUID(),
  chunkIndex: 0,
  content: 'Webhook retries must be idempotent.',
  tokenCount: 10,
  embedding: [0.1, 0.2, 0.3],
  contentTsv: null,
  createdAt: new Date(),
  ...args,
});
