import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AI_CLIENT } from '../../../ai/ai.constants';
import type { IAiClient } from '../../../ai/ai.interface';
import { STORAGE_CLIENT } from '../../../storage/storage.constants';
import type { IStorageClient } from '../../../storage/storage.interface';
import { IngestKbArticleResponseDto } from '../dto/ingest-kb-article-response.dto';
import { KbArticleIngestionService } from '../kb-article-ingestion.service';
import { REQUEST_KB_ARTICLE_PDF_UPLOAD_DEFAULTS } from './request-kb-article-pdf-upload.constants';
import { CompleteKbArticlePdfUploadCommand } from './complete-kb-article-pdf-upload.command';

@CommandHandler(CompleteKbArticlePdfUploadCommand)
export class CompleteKbArticlePdfUploadCommandHandler
  implements ICommandHandler<CompleteKbArticlePdfUploadCommand, IngestKbArticleResponseDto> {
  constructor(
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    @Inject(STORAGE_CLIENT) private readonly storageClient: IStorageClient,
    private readonly kbArticleIngestionService: KbArticleIngestionService,
  ) {}

  async execute(command: CompleteKbArticlePdfUploadCommand): Promise<IngestKbArticleResponseDto> {
    const { objectKey, title, sourceType } = command.dto;

    const buffer = await this.storageClient.getObject(objectKey);
    const extractedText = await this.aiClient.extractTextFromDocument(
      buffer,
      REQUEST_KB_ARTICLE_PDF_UPLOAD_DEFAULTS.MIME_TYPE,
    );

    return this.kbArticleIngestionService.ingest(title, sourceType, extractedText);
  }
}
