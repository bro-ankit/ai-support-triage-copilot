import { randomUUID, type UUID } from 'node:crypto';

import { EMBEDDING_DIMENSIONS } from '../../../../src/ai/gemini/gemini.constants';
import { KbChunkRepository } from '../../../../src/app/kb/repositories/kb-chunk.repository';
import type { KbChunkToInsert } from '../../../../src/app/kb/repositories/kb-chunk.types';
import { kbArticlesTable } from '../../../../src/schema/kb-articles.schema';
import { kbChunksTable } from '../../../../src/schema/kb-chunks.schema';
import { DrizzleTestEnvironment } from '../../../helpers/drizzle-test-environment';
import { mockKbArticleInsert, mockKbChunkToInsert } from '../../../__mocks__';

const embeddingOf = (fillValue: number): number[] => new Array(EMBEDDING_DIMENSIONS).fill(fillValue);

const orthogonalEmbedding = (): number[] =>
  Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i % 2 === 0 ? 0.1 : -0.1));

describe('KbChunkRepository IT', () => {
  let sut: KbChunkRepository;
  const env = new DrizzleTestEnvironment();
  let articleId: UUID;

  beforeAll(async () => {
    await env.start([KbChunkRepository]);
    sut = env.module.get(KbChunkRepository);
  }, 60_000);

  afterAll(async () => {
    await env.stop();
  });

  afterEach(async () => {
    await env.db.delete(kbChunksTable);
  });

  beforeEach(async () => {
    const [article] = await env.db.insert(kbArticlesTable).values(mockKbArticleInsert()).returning();
    articleId = article.id;
  });

  const seed = async (overrides: Partial<KbChunkToInsert> = {}): Promise<KbChunkToInsert> => {
    const chunk = mockKbChunkToInsert({ articleId, ...overrides });
    await sut.insertMany([chunk]);
    return chunk;
  };

  const expectedRow = (chunk: KbChunkToInsert, contentTsv: unknown = expect.any(String)) => ({
    ...chunk,
    contentTsv,
    createdAt: expect.any(Date),
  });

  describe('Given insertMany', () => {
    describe('When called with an empty array', () => {
      test('Then it does not insert anything', async () => {
        await sut.insertMany([]);

        const ids = await sut.findByLexical('anything', 10);
        expect(ids).toEqual([]);
      });
    });

    describe('When called with chunks', () => {
      test('Then it persists every chunk with a searchable tsvector column derived from its content', async () => {
        const target = await seed({ content: 'Webhook retries must be idempotent.' });
        await seed({ chunkIndex: 1, content: 'Unrelated billing export content.' });

        const ids = await sut.findByLexical('idempotent', 10);

        expect(ids).toHaveLength(1);
        const [chunk] = await sut.findByIds(ids);
        expect(chunk).toEqual(expectedRow(target, "'idempot':5 'must':3 'retri':2 'webhook':1"));
      });
    });

    describe('When called with more chunks than the insert batch size', () => {
      test('Then it inserts every chunk across multiple batched statements', async () => {
        const chunkCount = 501;
        const chunks = Array.from({ length: chunkCount }, (_, i) =>
          mockKbChunkToInsert({ articleId, chunkIndex: i, content: `chunk number ${i}` }),
        );

        await sut.insertMany(chunks);

        const ids = await sut.findSimilarIds(embeddingOf(0.1), chunkCount + 10, 2);
        expect(ids).toHaveLength(chunkCount);
      });
    });
  });

  describe('Given findSimilarIds', () => {
    describe('When candidates exist both within and beyond maxDistance', () => {
      test('Then it returns only the ids within maxDistance, ordered nearest first', async () => {
        const near = await seed({ content: 'near', tokenCount: 1, embedding: embeddingOf(0.1) });
        await seed({ chunkIndex: 1, content: 'far', embedding: orthogonalEmbedding() });

        const ids = await sut.findSimilarIds(embeddingOf(0.1), 10, 0.01);

        expect(ids).toHaveLength(1);
        const [chunk] = await sut.findByIds(ids);
        expect(chunk).toEqual(expectedRow(near));
      });
    });
  });

  describe('Given findByLexical', () => {
    describe('When no chunk matches the query', () => {
      test('Then it returns an empty array', async () => {
        await seed({ content: 'Unrelated billing export content.' });

        const ids = await sut.findByLexical('nonexistent-term', 10);

        expect(ids).toEqual([]);
      });
    });
  });

  describe('Given findByIds', () => {
    describe('When called with an empty array', () => {
      test('Then it returns an empty array without querying the database', async () => {
        const result = await sut.findByIds([]);

        expect(result).toEqual([]);
      });
    });

    describe('When called with ids that exist', () => {
      test('Then it returns the matching chunks', async () => {
        const target = await seed({ content: 'findByIds target' });

        const result = await sut.findByIds([target.id]);

        expect(result).toEqual([expectedRow(target)]);
      });
    });

    describe('When called with an id that does not exist', () => {
      test('Then it omits that id from the result', async () => {
        const result = await sut.findByIds([randomUUID()]);

        expect(result).toEqual([]);
      });
    });
  });
});
