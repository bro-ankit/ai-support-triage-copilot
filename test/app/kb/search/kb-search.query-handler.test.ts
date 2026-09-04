import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { KbSearchQuery } from '../../../../src/app/kb/search/kb-search.query';
import { KbSearchQueryHandler } from '../../../../src/app/kb/search/kb-search.query-handler';
import { KbSearchService } from '../../../../src/app/kb/search/kb-search.service';
import { mockKbChunkSelect } from '../../../__mocks__';

const QUERY_TEXT = 'why is the checkout webhook not idempotent';
const ARTICLE_ID = randomUUID();
const CHUNK = mockKbChunkSelect({ articleId: ARTICLE_ID, content: 'Webhook retries must be idempotent.' });

describe('KbSearchQueryHandler Unit Test', () => {
  let sut: KbSearchQueryHandler;
  let kbSearchService: jest.Mocked<KbSearchService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(KbSearchQueryHandler).compile();

    sut = unit;
    kbSearchService = unitRef.get(KbSearchService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given execute', () => {
    describe('When called with a search query', () => {
      test('Then it searches with the query text and returns the chunks serialized as KbSearchResultDto', async () => {
        kbSearchService.search.mockResolvedValue({ chunks: [CHUNK], isConfident: true });

        const result = await sut.execute(new KbSearchQuery(QUERY_TEXT));

        expect(kbSearchService.search).toHaveBeenCalledWith(QUERY_TEXT);
        expect(result).toEqual([
          {
            id: CHUNK.id,
            articleId: CHUNK.articleId,
            chunkIndex: CHUNK.chunkIndex,
            content: CHUNK.content,
            createdAt: CHUNK.createdAt,
          },
        ]);
      });
    });

    describe('When the search returns no chunks', () => {
      test('Then it returns an empty array', async () => {
        kbSearchService.search.mockResolvedValue({ chunks: [], isConfident: true });

        const result = await sut.execute(new KbSearchQuery(QUERY_TEXT));

        expect(result).toEqual([]);
      });
    });
  });
});
