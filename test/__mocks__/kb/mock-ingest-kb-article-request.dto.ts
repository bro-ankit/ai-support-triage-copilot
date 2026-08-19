import type { IngestKbArticleRequestDto } from '../../../src/app/kb/dto/ingest-kb-article-request.dto';

export const mockIngestKbArticleRequestDto = (
  args: Partial<IngestKbArticleRequestDto> = {},
): IngestKbArticleRequestDto => ({
  title: 'Payment webhook idempotency',
  sourceType: 'kb_article',
  rawContent: 'Webhooks must be processed idempotently to avoid duplicate side effects on retry.',
  ...args,
});
