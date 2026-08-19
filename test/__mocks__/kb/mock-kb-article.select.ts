import { randomUUID } from 'node:crypto';

import type { KbArticleSelect } from '../../../src/schema/kb-articles.schema';

export const mockKbArticleSelect = (args: Partial<KbArticleSelect> = {}): KbArticleSelect => ({
  id: randomUUID(),
  title: 'Payment webhook idempotency',
  sourceType: 'kb_article',
  rawContent: 'Webhooks must be processed idempotently to avoid duplicate side effects on retry.',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...args,
});
