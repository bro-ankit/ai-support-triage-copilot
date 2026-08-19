import { randomUUID } from 'node:crypto';

import type { KbArticleInsert } from '../../../src/schema/kb-articles.schema';

export const mockKbArticleInsert = (args: Partial<KbArticleInsert> = {}): KbArticleInsert => ({
  id: randomUUID(),
  title: 'Payment webhook idempotency',
  sourceType: 'kb_article',
  rawContent: 'Webhooks must be processed idempotently to avoid duplicate side effects on retry.',
  ...args,
});
