import type { RequestKbArticlePdfUploadRequestDto } from '../dto/request-kb-article-pdf-upload-request.dto';

export class RequestKbArticlePdfUploadCommand {
  constructor(public readonly dto: RequestKbArticlePdfUploadRequestDto) {}
}
