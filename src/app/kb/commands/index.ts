import { CompleteKbArticlePdfUploadCommandHandler } from './complete-kb-article-pdf-upload.command-handler';
import { IngestKbArticleCommandHandler } from './ingest-kb-article.command-handler';
import { RequestKbArticlePdfUploadCommandHandler } from './request-kb-article-pdf-upload.command-handler';

export const KB_COMMAND_HANDLERS = [
  IngestKbArticleCommandHandler,
  RequestKbArticlePdfUploadCommandHandler,
  CompleteKbArticlePdfUploadCommandHandler,
];
