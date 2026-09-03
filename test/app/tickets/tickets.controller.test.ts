import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ApproveTicketActionCommand } from '../../../src/app/tickets/commands/approve-ticket-action.command';
import { CompleteTicketAttachmentUploadCommand } from '../../../src/app/tickets/commands/complete-ticket-attachment-upload.command';
import { CreateTicketCommand } from '../../../src/app/tickets/commands/create-ticket.command';
import { ExecuteTicketActionCommand } from '../../../src/app/tickets/commands/execute-ticket-action.command';
import { RequestTicketAttachmentUploadCommand } from '../../../src/app/tickets/commands/request-ticket-attachment-upload.command';
import { TicketInvestigationGraphService } from '../../../src/app/tickets/graph/ticket-investigation-graph.service';
import type { TicketInvestigationStreamEvent } from '../../../src/app/tickets/graph/ticket-investigation-stream-event.types';
import { GetTicketQuery } from '../../../src/app/tickets/queries/get-ticket.query';
import { TicketsController } from '../../../src/app/tickets/tickets.controller';
import { AUTH_SCOPES } from '../../../src/auth/auth.constants';
import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';
import { ScopesGuard } from '../../../src/auth/guards/scopes.guard';
import { JwtStrategy } from '../../../src/auth/strategies/jwt.strategy';
import {
  mockCreateTicketRequestDto,
  mockRequestAttachmentUploadRequestDto,
  mockRequestAttachmentUploadResponseDto,
  mockTicketActionApprovalResponseDto,
  mockTicketAttachmentResponseDto,
  mockTicketInvestigationResponseDto,
  mockTicketInvestigationSelect,
  mockTicketResponseDto,
} from '../../__mocks__';
import { AuthMocks } from '../../__mocks__/auth/auth-mocks';
import { MockJwtStrategy } from '../../__mocks__/auth/mock-jwt.strategy';
import { AssertUtils } from '../../utils/assert.utils';

const TICKET_ID = randomUUID();
const ATTACHMENT_ID = randomUUID();
const INVESTIGATION_ID = randomUUID();

const MCP_TOKEN = AuthMocks.createMockToken(AuthMocks.buildMockUser({ scopes: [AUTH_SCOPES.MCP] }));
const APPROVE_ACTIONS_TOKEN = AuthMocks.createMockToken(
  AuthMocks.buildMockUser({ scopes: [AUTH_SCOPES.APPROVE_ACTIONS] }),
);
const NO_SCOPE_TOKEN = AuthMocks.createMockToken(AuthMocks.buildMockUser({ scopes: [] }));

async function* streamOf(events: TicketInvestigationStreamEvent[]): AsyncGenerator<TicketInvestigationStreamEvent> {
  for (const event of events) yield event;
}

describe('TicketsController Test', () => {
  let app: INestApplication;
  const mockCommandBus = { execute: jest.fn() };
  const mockQueryBus = { execute: jest.fn() };
  const mockInvestigationGraph = { investigateStream: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [TicketsController],
      providers: [
        JwtAuthGuard,
        ScopesGuard,
        JwtStrategy,
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
        { provide: TicketInvestigationGraphService, useValue: mockInvestigationGraph },
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

        expect(mockCommandBus.execute).toHaveBeenCalledWith(new RequestTicketAttachmentUploadCommand(TICKET_ID, body));
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
      test('Then it rejects with 401 without starting the investigation stream', async () => {
        await request(app.getHttpServer()).post(`/tickets/${TICKET_ID}/investigate`).expect(401);
        expect(mockInvestigationGraph.investigateStream).not.toHaveBeenCalled();
      });
    });

    describe('When the investigation succeeds', () => {
      test("Then it streams the graph's progress events followed by a mapped result event", async () => {
        const investigation = mockTicketInvestigationSelect({ id: randomUUID() });
        mockInvestigationGraph.investigateStream.mockReturnValue(
          streamOf([
            { type: 'progress', stage: 'context_loaded', message: 'Loaded context' },
            { type: 'progress', stage: 'classified', message: 'Classified ticket' },
            { type: 'result', investigation },
          ]),
        );

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/investigate`)
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .expect(201)
          .expect('Content-Type', /text\/event-stream/);

        expect(mockInvestigationGraph.investigateStream).toHaveBeenCalledWith(TICKET_ID, expect.any(AbortSignal));
        AssertUtils.assertSseEvents(response.text, [
          { event: 'progress', data: { stage: 'context_loaded', message: 'Loaded context' } },
          { event: 'progress', data: { stage: 'classified', message: 'Classified ticket' } },
          {
            event: 'result',
            data: {
              id: investigation.id,
              retrievedChunkIds: investigation.retrievedChunkIds,
              diagnosis: investigation.diagnosis,
              diagnosisConfidence: investigation.diagnosisConfidence,
              proposedAction: investigation.proposedAction,
              proposedActionReasoning: investigation.proposedActionReasoning,
              status: investigation.status,
              createdAt: investigation.createdAt.toISOString(),
            },
          },
        ]);
      });
    });

    describe('When the investigation fails', () => {
      test('Then it streams an error event instead of a result event', async () => {
        mockInvestigationGraph.investigateStream.mockReturnValue({
          [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('Ticket not found')) }),
        });

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/investigate`)
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .expect(201);

        AssertUtils.assertSseEvents(response.text, [{ event: 'error', data: { message: 'Ticket not found' } }]);
      });
    });
  });

  describe('Given POST /tickets/:id/investigations/:investigationId/approvals endpoint', () => {
    describe('When called with no bearer token', () => {
      test('Then it rejects with 401 without executing the command', async () => {
        await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/investigations/${INVESTIGATION_ID}/approvals`)
          .expect(401);
        expect(mockCommandBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with a token that only holds the mcp scope', () => {
      test('Then it rejects with 403, since an investigation-running caller must not approve its own proposed action', async () => {
        await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/investigations/${INVESTIGATION_ID}/approvals`)
          .set('Authorization', `Bearer ${MCP_TOKEN}`)
          .expect(403);
        expect(mockCommandBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with a valid approve_actions-scoped token', () => {
      test("Then it executes ApproveTicketActionCommand with the caller's userId and returns the approval", async () => {
        const approval = mockTicketActionApprovalResponseDto({ ticketInvestigationId: INVESTIGATION_ID });
        mockCommandBus.execute.mockResolvedValue(approval);

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/investigations/${INVESTIGATION_ID}/approvals`)
          .set('Authorization', `Bearer ${APPROVE_ACTIONS_TOKEN}`)
          .expect(201);

        expect(mockCommandBus.execute).toHaveBeenCalledWith(
          new ApproveTicketActionCommand(TICKET_ID, INVESTIGATION_ID, 'test-user-id'),
        );
        expect(response.body).toEqual({
          ...approval,
          approvedAt: approval.approvedAt.toISOString(),
          expiresAt: approval.expiresAt.toISOString(),
        });
      });
    });
  });

  describe('Given POST /tickets/:id/investigations/:investigationId/execute endpoint', () => {
    describe('When called with no bearer token', () => {
      test('Then it rejects with 401 without executing the command', async () => {
        await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/investigations/${INVESTIGATION_ID}/execute`)
          .expect(401);
        expect(mockCommandBus.execute).not.toHaveBeenCalled();
      });
    });

    describe('When called with any validly authenticated token, since execution is gated by the approval record itself', () => {
      test('Then it executes ExecuteTicketActionCommand and returns the updated investigation', async () => {
        const investigation = mockTicketInvestigationResponseDto({ id: INVESTIGATION_ID, status: 'action_executed' });
        mockCommandBus.execute.mockResolvedValue(investigation);

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/investigations/${INVESTIGATION_ID}/execute`)
          .set('Authorization', `Bearer ${NO_SCOPE_TOKEN}`)
          .expect(201);

        expect(mockCommandBus.execute).toHaveBeenCalledWith(
          new ExecuteTicketActionCommand(TICKET_ID, INVESTIGATION_ID),
        );
        expect(response.body).toEqual({ ...investigation, createdAt: investigation.createdAt.toISOString() });
      });
    });
  });
});
