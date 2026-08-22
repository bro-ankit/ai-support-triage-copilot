import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import { IngestKbArticleCommand } from '../../../../src/app/kb/commands/ingest-kb-article.command';
import { IngestKbArticleCommandHandler } from '../../../../src/app/kb/commands/ingest-kb-article.command-handler';
import { KbArticleRepository } from '../../../../src/app/kb/repositories/kb-article.repository';
import { KbChunkRepository } from '../../../../src/app/kb/repositories/kb-chunk.repository';
import { DrizzleTransactionService } from '../../../../src/database/drizzle-transaction.service';
import { mockIngestKbArticleRequestDto, mockKbArticleSelect } from '../../../__mocks__';

const PARAGRAPH_ONE = 'A'.repeat(600);
const PARAGRAPH_TWO = 'B'.repeat(600);
const REQUEST = mockIngestKbArticleRequestDto({ rawContent: `${PARAGRAPH_ONE}\n\n${PARAGRAPH_TWO}` });

const EMBEDDING_ONE = [0.1, 0.2, 0.3];
const EMBEDDING_TWO = [0.4, 0.5, 0.6];
const EMBEDDINGS_BY_CONTENT = new Map([
  [PARAGRAPH_ONE, EMBEDDING_ONE],
  [PARAGRAPH_TWO, EMBEDDING_TWO],
]);

const INSERTED_ARTICLE = mockKbArticleSelect({
  title: REQUEST.title,
  sourceType: REQUEST.sourceType,
  rawContent: REQUEST.rawContent,
});

describe('IngestKbArticleCommandHandler Unit Test', () => {
  let sut: IngestKbArticleCommandHandler;
  let aiClient: jest.Mocked<IAiClient>;
  let dbTransactionService: jest.Mocked<DrizzleTransactionService>;
  let kbArticleRepository: jest.Mocked<KbArticleRepository>;
  let kbChunkRepository: jest.Mocked<KbChunkRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(IngestKbArticleCommandHandler).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    dbTransactionService = unitRef.get(DrizzleTransactionService);
    kbArticleRepository = unitRef.get(KbArticleRepository);
    kbChunkRepository = unitRef.get(KbChunkRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dbTransactionService.execute.mockImplementation((fn: () => Promise<unknown>) => fn() as Promise<never>);
    aiClient.generateEmbedding.mockImplementation(async (content: string) => {
      const embedding = EMBEDDINGS_BY_CONTENT.get(content);
      return embedding as number[];
    });
    kbArticleRepository.insert.mockResolvedValue(INSERTED_ARTICLE);
  });

  describe('Given execute', () => {
    describe('When called with a request that chunks into two pieces', () => {
      test('Then it embeds every chunk before inserting, inserts the article and chunks with matching embeddings, and returns the response', async () => {
        const result = await sut.execute(new IngestKbArticleCommand(REQUEST));

        expect(aiClient.generateEmbedding.mock.invocationCallOrder[1]).toBeLessThan(
          kbArticleRepository.insert.mock.invocationCallOrder[0],
        );

        expect(aiClient.generateEmbedding.mock.calls).toStrictEqual([[PARAGRAPH_ONE], [PARAGRAPH_TWO]]);

        expect(kbArticleRepository.insert.mock.calls).toStrictEqual([
          [
            {
              id: expect.any(String),
              title: REQUEST.title,
              sourceType: REQUEST.sourceType,
              rawContent: REQUEST.rawContent,
            },
          ],
        ]);

        expect(kbChunkRepository.insertMany.mock.calls).toStrictEqual([
          [
            [
              {
                id: expect.any(String),
                articleId: INSERTED_ARTICLE.id,
                chunkIndex: 0,
                content: PARAGRAPH_ONE,
                tokenCount: Math.ceil(PARAGRAPH_ONE.length / 4),
                embedding: EMBEDDING_ONE,
              },
              {
                id: expect.any(String),
                articleId: INSERTED_ARTICLE.id,
                chunkIndex: 1,
                content: PARAGRAPH_TWO,
                tokenCount: Math.ceil(PARAGRAPH_TWO.length / 4),
                embedding: EMBEDDING_TWO,
              },
            ],
          ],
        ]);

        expect(result).toEqual({ id: INSERTED_ARTICLE.id, title: REQUEST.title, chunkCount: 2 });
      });
    });

    describe('When the request content contains hidden zero-width characters', () => {
      test('Then it strips them before chunking, embedding, and persisting the article', async () => {
        const zeroWidthSpace = String.fromCharCode(0x200b);
        const dirtyContent = `${PARAGRAPH_ONE}${zeroWidthSpace}`;
        const request = mockIngestKbArticleRequestDto({ rawContent: dirtyContent });
        const insertedArticle = mockKbArticleSelect({
          title: request.title,
          sourceType: request.sourceType,
          rawContent: PARAGRAPH_ONE,
        });
        kbArticleRepository.insert.mockResolvedValue(insertedArticle);
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING_ONE);

        await sut.execute(new IngestKbArticleCommand(request));

        expect(kbArticleRepository.insert).toHaveBeenCalledWith({
          id: expect.any(String),
          title: request.title,
          sourceType: request.sourceType,
          rawContent: PARAGRAPH_ONE,
        });
        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(PARAGRAPH_ONE);
      });
    });
  });
});
