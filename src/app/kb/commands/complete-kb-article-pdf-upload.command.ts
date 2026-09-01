import type { CompleteKbArticlePdfUploadRequestDto } from '../dto/complete-kb-article-pdf-upload-request.dto';

export class CompleteKbArticlePdfUploadCommand {
  constructor(public readonly dto: CompleteKbArticlePdfUploadRequestDto) {}
}
