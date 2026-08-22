import { randomUUID } from 'node:crypto';

import type { KbArticleSelect } from '../../../src/schema/kb-articles.schema';
import { MOCK_TENANT_ID } from '../mock-tenant-id';

export const mockKbArticleSelect = (args: Partial<KbArticleSelect> = {}): KbArticleSelect => ({
  id: randomUUID(),
  tenantId: MOCK_TENANT_ID,
  title: 'Payment webhook idempotency',
  sourceType: 'kb_article',
  rawContent: 'Webhooks must be processed idempotently to avoid duplicate side effects on retry.',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...args,
});
