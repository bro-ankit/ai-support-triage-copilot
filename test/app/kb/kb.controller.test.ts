import { INestApplication } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { IngestKbArticleCommand } from '../../../src/app/kb/commands/ingest-kb-article.command';
import { KbController } from '../../../src/app/kb/kb.controller';
import { KbSearchQuery } from '../../../src/app/kb/search/kb-search.query';
import { AUTH_SCOPES } from '../../../src/auth/auth.constants';
import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';
import { ScopesGuard } from '../../../src/auth/guards/scopes.guard';
import { JwtStrategy } from '../../../src/auth/strategies/jwt.strategy';
import { AuthMocks } from '../../__mocks__/auth/auth-mocks';
import { MockJwtStrategy } from '../../__mocks__/auth/mock-jwt.strategy';
import { mockIngestKbArticleRequestDto, mockKbSearchQueryDto } from '../../__mocks__';

const MCP_TOKEN = AuthMocks.createMockToken(AuthMocks.buildMockUser({ scopes: [AUTH_SCOPES.MCP] }));
const NO_SCOPE_TOKEN = AuthMocks.createMockToken(AuthMocks.buildMockUser({ scopes: [] }));

describe('KbController Test', () => {
  let app: INestApplication;
  const mockCommandBus = { execute: jest.fn() };
  const mockQueryBus = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [KbController],
      providers: [
        JwtAuthGuard,
        ScopesGuard,
        JwtStrategy,
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
      ],
    })
      .overrideProvider(JwtStrategy)
      .useValue(new MockJwtStrategy())
      .compile();

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
    describe('When called with no bearer token', () => {
      test('Then it rejects with 401 without executing the command', async () => {
        await request(app.getHttpServer()).post('/kb/articles').send(mockIngestKbArticleRequestDto()).expect(401);
        expect(mockCommandBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with a token that lacks the mcp scope', () => {
      test('Then it rejects with 403 without executing the command', async () => {
        await request(app.getHttpServer())
          .post('/kb/articles')
          .set('Authorization', `Bearer ${NO_SCOPE_TOKEN}`)
          .send(mockIngestKbArticleRequestDto())
          .expect(403);
        expect(mockCommandBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with a valid mcp-scoped token', () => {
      test('Then it executes IngestKbArticleCommand with the request body and returns the command result', async () => {
        const body = mockIngestKbArticleRequestDto();
        const commandResult = { id: 'article-id', title: body.title, chunkCount: 2 };
        mockCommandBus.execute.mockResolvedValue(commandResult);

        const response = await request(app.getHttpServer())
          .post('/kb/articles')
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .send(body)
          .expect(201);

        expect(mockCommandBus.execute).toHaveBeenCalledWith(new IngestKbArticleCommand(body));
        expect(response.body).toEqual(commandResult);
      });
    });
  });

  describe('Given GET /kb/search endpoint', () => {
    describe('When called with no bearer token', () => {
      test('Then it rejects with 401 without executing the query', async () => {
        await request(app.getHttpServer()).get('/kb/search').query({ q: 'anything' }).expect(401);
        expect(mockQueryBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with a token that lacks the mcp scope', () => {
      test('Then it rejects with 403 without executing the query', async () => {
        await request(app.getHttpServer())
          .get('/kb/search')
          .set('Authorization', `Bearer ${NO_SCOPE_TOKEN}`)
          .query({ q: 'anything' })
          .expect(403);
        expect(mockQueryBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with a valid mcp-scoped token and a query', () => {
      test('Then it executes KbSearchQuery with the query text and returns the query result', async () => {
        const dto = mockKbSearchQueryDto();
        const queryResult = [{ id: 'chunk-id', articleId: 'article-id', chunkIndex: 0, content: 'x' }];
        mockQueryBus.execute.mockResolvedValue(queryResult);

        const response = await request(app.getHttpServer())
          .get('/kb/search')
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .query({ q: dto.q })
          .expect(200);

        expect(mockQueryBus.execute).toHaveBeenCalledWith(new KbSearchQuery(dto.q));
        expect(response.body).toEqual(queryResult);
      });
    });
  });
});
