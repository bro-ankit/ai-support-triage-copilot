import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import { CompleteKbArticlePdfUploadCommand } from '../../../../src/app/kb/commands/complete-kb-article-pdf-upload.command';
import { CompleteKbArticlePdfUploadCommandHandler } from '../../../../src/app/kb/commands/complete-kb-article-pdf-upload.command-handler';
import { REQUEST_KB_ARTICLE_PDF_UPLOAD_DEFAULTS } from '../../../../src/app/kb/commands/request-kb-article-pdf-upload.constants';
import type { CompleteKbArticlePdfUploadRequestDto } from '../../../../src/app/kb/dto/complete-kb-article-pdf-upload-request.dto';
import { KbArticleIngestionService } from '../../../../src/app/kb/kb-article-ingestion.service';
import { STORAGE_CLIENT } from '../../../../src/storage/storage.constants';
import type { IStorageClient } from '../../../../src/storage/storage.interface';

const REQUEST: CompleteKbArticlePdfUploadRequestDto = {
  objectKey: 'kb-articles/abc-postmortem.pdf',
  title: 'Duplicate charge postmortem',
  sourceType: 'postmortem',
};
const FILE_BUFFER = Buffer.from('fake-pdf-bytes');
const EXTRACTED_TEXT = 'Postmortem: duplicate charges caused by non-idempotent webhook retries.';

describe('CompleteKbArticlePdfUploadCommandHandler Unit Test', () => {
  let sut: CompleteKbArticlePdfUploadCommandHandler;
  let aiClient: jest.Mocked<IAiClient>;
  let storageClient: jest.Mocked<IStorageClient>;
  let kbArticleIngestionService: jest.Mocked<KbArticleIngestionService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(CompleteKbArticlePdfUploadCommandHandler).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    storageClient = unitRef.get(STORAGE_CLIENT);
    kbArticleIngestionService = unitRef.get(KbArticleIngestionService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    storageClient.getObject.mockResolvedValue(FILE_BUFFER);
    aiClient.extractTextFromDocument.mockResolvedValue(EXTRACTED_TEXT);
  });

  describe('Given execute', () => {
    describe('When called', () => {
      test('Then it fetches the object, extracts document text, and ingests the extracted text', async () => {
        const response = { id: 'article-id', title: REQUEST.title, chunkCount: 3 };
        kbArticleIngestionService.ingest.mockResolvedValue(response);

        const result = await sut.execute(new CompleteKbArticlePdfUploadCommand(REQUEST));

        expect(storageClient.getObject).toHaveBeenCalledWith(REQUEST.objectKey);
        expect(aiClient.extractTextFromDocument).toHaveBeenCalledWith(
          FILE_BUFFER,
          REQUEST_KB_ARTICLE_PDF_UPLOAD_DEFAULTS.MIME_TYPE,
        );
        expect(kbArticleIngestionService.ingest).toHaveBeenCalledWith(REQUEST.title, REQUEST.sourceType, EXTRACTED_TEXT);
        expect(result).toEqual(response);
      });
    });
  });
});
