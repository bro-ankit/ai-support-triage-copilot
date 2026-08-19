import type { IngestKbArticleRequestDto } from '../dto/ingest-kb-article-request.dto';

export class IngestKbArticleCommand {
  constructor(public readonly dto: IngestKbArticleRequestDto) {}
}
