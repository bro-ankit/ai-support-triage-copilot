import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Subject } from 'rxjs';
import request from 'supertest';

import { CompleteTicketAttachmentUploadCommand } from '../../../src/app/tickets/commands/complete-ticket-attachment-upload.command';
import { CreateTicketCommand } from '../../../src/app/tickets/commands/create-ticket.command';
import { RequestTicketAttachmentUploadCommand } from '../../../src/app/tickets/commands/request-ticket-attachment-upload.command';
import { TicketInvestigationProgressEvent } from '../../../src/app/tickets/events/ticket-investigation-progress.event';
import { GetTicketQuery } from '../../../src/app/tickets/queries/get-ticket.query';
import { TicketsController } from '../../../src/app/tickets/tickets.controller';
import { AUTH_SCOPES } from '../../../src/auth/auth.constants';
import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';
import { ScopesGuard } from '../../../src/auth/guards/scopes.guard';
import { JwtStrategy } from '../../../src/auth/strategies/jwt.strategy';
import { AuthMocks } from '../../__mocks__/auth/auth-mocks';
import { MockJwtStrategy } from '../../__mocks__/auth/mock-jwt.strategy';
import {
  mockCreateTicketRequestDto,
  mockRequestAttachmentUploadRequestDto,
  mockRequestAttachmentUploadResponseDto,
  mockTicketAttachmentResponseDto,
  mockTicketInvestigationResponseDto,
  mockTicketResponseDto,
} from '../../__mocks__';
import { InvestigateTicketCommand } from '../../../src/app/tickets/commands/investigate-ticket.command';
import { AssertUtils } from '../../utils/assert.utils';

const TICKET_ID = randomUUID();
const ATTACHMENT_ID = randomUUID();

const MCP_TOKEN = AuthMocks.createMockToken(AuthMocks.buildMockUser({ scopes: [AUTH_SCOPES.MCP] }));
const NO_SCOPE_TOKEN = AuthMocks.createMockToken(AuthMocks.buildMockUser({ scopes: [] }));

describe('TicketsController Test', () => {
  let app: INestApplication;
  const mockCommandBus = { execute: jest.fn() };
  const mockQueryBus = { execute: jest.fn() };
  let eventBus: Subject<TicketInvestigationProgressEvent>;

  beforeAll(async () => {
    eventBus = new Subject<TicketInvestigationProgressEvent>();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [TicketsController],
      providers: [
        JwtAuthGuard,
        ScopesGuard,
        JwtStrategy,
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
        { provide: EventBus, useValue: eventBus },
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

  describe('Given POST /tickets endpoint', () => {
    describe('When called with no bearer token', () => {
      test('Then it rejects with 401 without executing the command', async () => {
        await request(app.getHttpServer()).post('/tickets').send(mockCreateTicketRequestDto()).expect(401);
        expect(mockCommandBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with a token that lacks the mcp scope', () => {
      test('Then it rejects with 403 without executing the command', async () => {
        await request(app.getHttpServer())
          .post('/tickets')
          .set('Authorization', `Bearer ${NO_SCOPE_TOKEN}`)
          .send(mockCreateTicketRequestDto())
          .expect(403);
        expect(mockCommandBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with a valid mcp-scoped token and a valid body', () => {
      test('Then it executes CreateTicketCommand with the request body and returns the command result', async () => {
        const body = mockCreateTicketRequestDto();
        const commandResult = mockTicketResponseDto({ id: TICKET_ID, subject: body.subject });
        mockCommandBus.execute.mockResolvedValue(commandResult);

        const response = await request(app.getHttpServer())
          .post('/tickets')
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .send(body)
          .expect(201);

        expect(mockCommandBus.execute).toHaveBeenCalledWith(new CreateTicketCommand(body));
        expect(response.body).toEqual({ ...commandResult, createdAt: commandResult.createdAt.toISOString() });
      });
    });
  });

  describe('Given POST /tickets/:id/attachments/presign endpoint', () => {
    describe('When called with a valid mcp-scoped token and a valid body', () => {
      test('Then it executes RequestTicketAttachmentUploadCommand with the ticket id and body and returns the result', async () => {
        const body = mockRequestAttachmentUploadRequestDto();
        const commandResult = mockRequestAttachmentUploadResponseDto({
          attachmentId: ATTACHMENT_ID,
          objectKey: `tickets/${TICKET_ID}/${randomUUID()}-${body.filename}`,
        });
        mockCommandBus.execute.mockResolvedValue(commandResult);

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/attachments/presign`)
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .send(body)
          .expect(201);

        expect(mockCommandBus.execute).toHaveBeenCalledWith(
          new RequestTicketAttachmentUploadCommand(TICKET_ID, body),
        );
        expect(response.body).toEqual(commandResult);
      });
    });
  });

  describe('Given POST /tickets/:id/attachments/:attachmentId/complete endpoint', () => {
    describe('When called with a valid mcp-scoped token', () => {
      test('Then it executes CompleteTicketAttachmentUploadCommand with the ticket and attachment ids and returns the result', async () => {
        const commandResult = mockTicketAttachmentResponseDto({ id: ATTACHMENT_ID });
        mockCommandBus.execute.mockResolvedValue(commandResult);

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/attachments/${ATTACHMENT_ID}/complete`)
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .expect(201);

        expect(mockCommandBus.execute).toHaveBeenCalledWith(
          new CompleteTicketAttachmentUploadCommand(TICKET_ID, ATTACHMENT_ID),
        );
        expect(response.body).toEqual(commandResult);
      });
    });
  });

  describe('Given GET /tickets/:id endpoint', () => {
    describe('When called with no bearer token', () => {
      test('Then it rejects with 401 without executing the query', async () => {
        await request(app.getHttpServer()).get(`/tickets/${TICKET_ID}`).expect(401);
        expect(mockQueryBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with a valid mcp-scoped token and an existing ticket id', () => {
      test('Then it executes GetTicketQuery with the ticket id and returns the query result', async () => {
        const queryResult = mockTicketResponseDto({ id: TICKET_ID });
        mockQueryBus.execute.mockResolvedValue(queryResult);

        const response = await request(app.getHttpServer())
          .get(`/tickets/${TICKET_ID}`)
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .expect(200);

        expect(mockQueryBus.execute).toHaveBeenCalledWith(new GetTicketQuery(TICKET_ID));
        expect(response.body).toEqual({ ...queryResult, createdAt: queryResult.createdAt.toISOString() });
      });
    });
  });

  describe('Given POST /tickets/:id/investigate endpoint', () => {
    describe('When called with no bearer token', () => {
      test('Then it rejects with 401 without executing the command', async () => {
        await request(app.getHttpServer()).post(`/tickets/${TICKET_ID}/investigate`).expect(401);
        expect(mockCommandBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When the investigation succeeds', () => {
      test('Then it streams progress events published on the event bus followed by a result event', async () => {
        const investigation = mockTicketInvestigationResponseDto({ id: randomUUID() });
        mockCommandBus.execute.mockImplementation(async () => {
          eventBus.next(new TicketInvestigationProgressEvent(TICKET_ID, 'context_loaded', 'Loaded context'));
          eventBus.next(new TicketInvestigationProgressEvent(TICKET_ID, 'classified', 'Classified ticket'));
          return investigation;
        });

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/investigate`)
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .expect(201)
          .expect('Content-Type', /text\/event-stream/);

        expect(mockCommandBus.execute).toHaveBeenCalledWith(
          new InvestigateTicketCommand(TICKET_ID, expect.any(AbortSignal)),
        );
        AssertUtils.assertSseEvents(response.text, [
          { event: 'progress', data: { stage: 'context_loaded', message: 'Loaded context' } },
          { event: 'progress', data: { stage: 'classified', message: 'Classified ticket' } },
          { event: 'result', data: { ...investigation, createdAt: investigation.createdAt.toISOString() } },
        ]);
      });
    });

    describe('When another ticket\'s progress event is published concurrently', () => {
      test('Then it only streams progress events for the requested ticket', async () => {
        const investigation = mockTicketInvestigationResponseDto({ id: randomUUID() });
        const otherTicketId = randomUUID();
        mockCommandBus.execute.mockImplementation(async () => {
          eventBus.next(new TicketInvestigationProgressEvent(otherTicketId, 'context_loaded', 'Other ticket'));
          eventBus.next(new TicketInvestigationProgressEvent(TICKET_ID, 'context_loaded', 'This ticket'));
          return investigation;
        });

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/investigate`)
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .expect(201);

        AssertUtils.assertSseEvents(response.text, [
          { event: 'progress', data: { stage: 'context_loaded', message: 'This ticket' } },
          { event: 'result', data: { ...investigation, createdAt: investigation.createdAt.toISOString() } },
        ]);
      });
    });

    describe('When the investigation fails', () => {
      test('Then it streams an error event instead of a result event', async () => {
        mockCommandBus.execute.mockRejectedValue(new Error('Ticket not found'));

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/investigate`)
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .expect(201);

        AssertUtils.assertSseEvents(response.text, [{ event: 'error', data: { message: 'Ticket not found' } }]);
      });
    });
  });
});
