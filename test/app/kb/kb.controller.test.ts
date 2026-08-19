import { INestApplication } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { IngestKbArticleCommand } from '../../../src/app/kb/commands/ingest-kb-article.command';
import { KbController } from '../../../src/app/kb/kb.controller';
import { KbSearchQuery } from '../../../src/app/kb/search/kb-search.query';
import { mockIngestKbArticleRequestDto, mockKbSearchQueryDto } from '../../__mocks__';


describe('KbController Test', () => {
  let app: INestApplication;
  const mockCommandBus = { execute: jest.fn() };
  const mockQueryBus = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [KbController],
      providers: [
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given POST /kb/articles endpoint', () => {
    describe('When called with a valid body', () => {
      test('Then it executes IngestKbArticleCommand with the request body and returns the command result', async () => {
        const body = mockIngestKbArticleRequestDto();
        const commandResult = { id: 'article-id', title: body.title, chunkCount: 2 };
        mockCommandBus.execute.mockResolvedValue(commandResult);

        const response = await request(app.getHttpServer()).post('/kb/articles').send(body).expect(201);

        expect(mockCommandBus.execute).toHaveBeenCalledWith(new IngestKbArticleCommand(body));
        expect(response.body).toEqual(commandResult);
      });
    });
  });

  describe('Given GET /kb/search endpoint', () => {
    describe('When called with a query', () => {
      test('Then it executes KbSearchQuery with the query text and returns the query result', async () => {
        const dto = mockKbSearchQueryDto();
        const queryResult = [{ id: 'chunk-id', articleId: 'article-id', chunkIndex: 0, content: 'x' }];
        mockQueryBus.execute.mockResolvedValue(queryResult);

        const response = await request(app.getHttpServer()).get('/kb/search').query({ q: dto.q }).expect(200);

        expect(mockQueryBus.execute).toHaveBeenCalledWith(new KbSearchQuery(dto.q));
        expect(response.body).toEqual(queryResult);
      });
    });
  });
});
