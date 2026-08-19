import { randomUUID } from 'node:crypto';

import { KbArticleRepository } from '../../../../src/app/kb/repositories/kb-article.repository';
import type { KbArticleInsert } from '../../../../src/schema/kb-articles.schema';
import { kbArticlesTable } from '../../../../src/schema/kb-articles.schema';
import { DrizzleTestEnvironment } from '../../../helpers/drizzle-test-environment';
import { mockKbArticleInsert } from '../../../__mocks__';

describe('KbArticleRepository IT', () => {
  let sut: KbArticleRepository;
  const env = new DrizzleTestEnvironment();

  beforeAll(async () => {
    await env.start([KbArticleRepository]);
    sut = env.module.get(KbArticleRepository);
  }, 60_000);

  afterAll(async () => {
    await env.stop();
  });

  afterEach(async () => {
    await env.db.delete(kbArticlesTable);
  });

  const seed = (overrides: Partial<KbArticleInsert> = {}) => sut.insert(mockKbArticleInsert(overrides));

  describe('Given insert', () => {
    describe('When called with a valid article', () => {
      test('Then it persists the article and returns it with the given id and generated timestamps', async () => {
        const data = mockKbArticleInsert({ title: 'OAuth refresh-token failures' });

        const result = await sut.insert(data);

        expect(result).toEqual({
          id: data.id,
          title: data.title,
          sourceType: data.sourceType,
          rawContent: data.rawContent,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });
    });
  });

  describe('Given findById', () => {
    describe('When the article exists', () => {
      test('Then it returns that article', async () => {
        const inserted = await seed({ title: 'S3 upload timeouts' });

        const result = await sut.findById(inserted.id);

        expect(result).toEqual(inserted);
      });
    });

    describe('When the article does not exist', () => {
      test('Then it returns undefined', async () => {
        const result = await sut.findById(randomUUID());

        expect(result).toBeUndefined();
      });
    });
  });
});
