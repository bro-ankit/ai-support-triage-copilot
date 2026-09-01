import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { ContextualChunkService } from '../../../src/app/kb/helpers/contextual-chunk.service';
import { KbArticleIngestionService } from '../../../src/app/kb/kb-article-ingestion.service';
import { KbArticleRepository } from '../../../src/app/kb/repositories/kb-article.repository';
import { KbChunkRepository } from '../../../src/app/kb/repositories/kb-chunk.repository';
import { DrizzleTransactionService } from '../../../src/database/drizzle-transaction.service';
import { mockKbArticleSelect } from '../../__mocks__';

const PARAGRAPH_ONE = 'A'.repeat(600);
const PARAGRAPH_TWO = 'B'.repeat(600);
const RAW_CONTENT = `${PARAGRAPH_ONE}\n\n${PARAGRAPH_TWO}`;
const TITLE = 'Duplicate charge postmortem';
const SOURCE_TYPE = 'postmortem';

const ENRICHED_ONE = `Context for one.\n\n${PARAGRAPH_ONE}`;
const ENRICHED_TWO = `Context for two.\n\n${PARAGRAPH_TWO}`;

const EMBEDDING_ONE = [0.1, 0.2, 0.3];
const EMBEDDING_TWO = [0.4, 0.5, 0.6];
const EMBEDDINGS_BY_CONTENT = new Map([
  [ENRICHED_ONE, EMBEDDING_ONE],
  [ENRICHED_TWO, EMBEDDING_TWO],
]);

const INSERTED_ARTICLE = mockKbArticleSelect({ title: TITLE, sourceType: SOURCE_TYPE, rawContent: RAW_CONTENT });

describe('KbArticleIngestionService Unit Test', () => {
  let sut: KbArticleIngestionService;
  let aiClient: jest.Mocked<IAiClient>;
  let dbTransactionService: jest.Mocked<DrizzleTransactionService>;
  let kbArticleRepository: jest.Mocked<KbArticleRepository>;
  let kbChunkRepository: jest.Mocked<KbChunkRepository>;
  let contextualChunkService: jest.Mocked<ContextualChunkService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(KbArticleIngestionService).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    dbTransactionService = unitRef.get(DrizzleTransactionService);
    kbArticleRepository = unitRef.get(KbArticleRepository);
    kbChunkRepository = unitRef.get(KbChunkRepository);
    contextualChunkService = unitRef.get(ContextualChunkService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dbTransactionService.execute.mockImplementation((fn: () => Promise<unknown>) => fn() as Promise<never>);
    contextualChunkService.enrichChunks.mockImplementation(async (_doc, chunks) =>
      chunks.map((chunk) => ({ ...chunk, content: chunk.chunkIndex === 0 ? ENRICHED_ONE : ENRICHED_TWO })),
    );
    aiClient.generateEmbedding.mockImplementation(async (content: string) => {
      const embedding = EMBEDDINGS_BY_CONTENT.get(content);
      return embedding as number[];
    });
    kbArticleRepository.insert.mockResolvedValue(INSERTED_ARTICLE);
  });

  describe('Given ingest', () => {
    describe('When called with content that chunks into two pieces', () => {
      test('Then it contextualizes chunks before embedding, embeds every chunk before inserting, inserts the article and chunks, and returns the response', async () => {
        const result = await sut.ingest(TITLE, SOURCE_TYPE, RAW_CONTENT);

        expect(contextualChunkService.enrichChunks).toHaveBeenCalledWith(RAW_CONTENT, [
          { chunkIndex: 0, content: PARAGRAPH_ONE },
          { chunkIndex: 1, content: PARAGRAPH_TWO },
        ]);

        expect(aiClient.generateEmbedding.mock.invocationCallOrder[1]).toBeLessThan(
          kbArticleRepository.insert.mock.invocationCallOrder[0],
        );
        expect(aiClient.generateEmbedding.mock.calls).toStrictEqual([[ENRICHED_ONE], [ENRICHED_TWO]]);

        expect(kbArticleRepository.insert.mock.calls).toStrictEqual([
          [{ id: expect.any(String), title: TITLE, sourceType: SOURCE_TYPE, rawContent: RAW_CONTENT }],
        ]);

        expect(kbChunkRepository.insertMany.mock.calls).toStrictEqual([
          [
            [
              {
                id: expect.any(String),
                articleId: INSERTED_ARTICLE.id,
                chunkIndex: 0,
                content: ENRICHED_ONE,
                tokenCount: Math.ceil(ENRICHED_ONE.length / 4),
                embedding: EMBEDDING_ONE,
              },
              {
                id: expect.any(String),
                articleId: INSERTED_ARTICLE.id,
                chunkIndex: 1,
                content: ENRICHED_TWO,
                tokenCount: Math.ceil(ENRICHED_TWO.length / 4),
                embedding: EMBEDDING_TWO,
              },
            ],
          ],
        ]);

        expect(result).toEqual({ id: INSERTED_ARTICLE.id, title: TITLE, chunkCount: 2 });
      });
    });

    describe('When the content contains hidden zero-width characters', () => {
      test('Then it strips them before chunking, contextualizing, embedding, and persisting the article', async () => {
        const zeroWidthSpace = String.fromCharCode(0x200b);
        const dirtyContent = `${PARAGRAPH_ONE}${zeroWidthSpace}`;
        const insertedArticle = mockKbArticleSelect({ title: TITLE, sourceType: SOURCE_TYPE, rawContent: PARAGRAPH_ONE });
        kbArticleRepository.insert.mockResolvedValue(insertedArticle);
        contextualChunkService.enrichChunks.mockResolvedValue([{ chunkIndex: 0, content: ENRICHED_ONE }]);
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING_ONE);

        await sut.ingest(TITLE, SOURCE_TYPE, dirtyContent);

        expect(kbArticleRepository.insert).toHaveBeenCalledWith({
          id: expect.any(String),
          title: TITLE,
          sourceType: SOURCE_TYPE,
          rawContent: PARAGRAPH_ONE,
        });
        expect(contextualChunkService.enrichChunks).toHaveBeenCalledWith(PARAGRAPH_ONE, [
          { chunkIndex: 0, content: PARAGRAPH_ONE },
        ]);
      });
    });
  });
});
