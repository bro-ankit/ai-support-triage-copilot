import { TestBed } from '@automock/jest';

import { IngestKbArticleCommand } from '../../../../src/app/kb/commands/ingest-kb-article.command';
import { IngestKbArticleCommandHandler } from '../../../../src/app/kb/commands/ingest-kb-article.command-handler';
import { KbArticleIngestionService } from '../../../../src/app/kb/kb-article-ingestion.service';
import { mockIngestKbArticleRequestDto } from '../../../__mocks__';

const REQUEST = mockIngestKbArticleRequestDto();

describe('IngestKbArticleCommandHandler Unit Test', () => {
  let sut: IngestKbArticleCommandHandler;
  let kbArticleIngestionService: jest.Mocked<KbArticleIngestionService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(IngestKbArticleCommandHandler).compile();

    sut = unit;
    kbArticleIngestionService = unitRef.get(KbArticleIngestionService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given execute', () => {
    describe('When called', () => {
      test('Then it delegates to KbArticleIngestionService.ingest with the request fields and returns its result', async () => {
        const response = { id: 'article-id', title: REQUEST.title, chunkCount: 2 };
        kbArticleIngestionService.ingest.mockResolvedValue(response);

        const result = await sut.execute(new IngestKbArticleCommand(REQUEST));

        expect(kbArticleIngestionService.ingest).toHaveBeenCalledWith(REQUEST.title, REQUEST.sourceType, REQUEST.rawContent);
        expect(result).toEqual(response);
      });
    });
  });
});
