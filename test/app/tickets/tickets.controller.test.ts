import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { CompleteTicketAttachmentUploadCommand } from '../../../src/app/tickets/commands/complete-ticket-attachment-upload.command';
import { CreateTicketCommand } from '../../../src/app/tickets/commands/create-ticket.command';
import { RequestTicketAttachmentUploadCommand } from '../../../src/app/tickets/commands/request-ticket-attachment-upload.command';
import { GetTicketQuery } from '../../../src/app/tickets/queries/get-ticket.query';
import { TicketsController } from '../../../src/app/tickets/tickets.controller';
import { mockCreateTicketRequestDto, mockRequestAttachmentUploadRequestDto } from '../../__mocks__';

const TICKET_ID = randomUUID();
const ATTACHMENT_ID = randomUUID();

describe('TicketsController Test', () => {
  let app: INestApplication;
  const mockCommandBus = { execute: jest.fn() };
  const mockQueryBus = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TicketsController],
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

  describe('Given POST /tickets endpoint', () => {
    describe('When called with a valid body', () => {
      test('Then it executes CreateTicketCommand with the request body and returns the command result', async () => {
        const body = mockCreateTicketRequestDto();
        const commandResult = { id: TICKET_ID, subject: body.subject, attachments: [] };
        mockCommandBus.execute.mockResolvedValue(commandResult);

        const response = await request(app.getHttpServer()).post('/tickets').send(body).expect(201);

        expect(mockCommandBus.execute).toHaveBeenCalledWith(new CreateTicketCommand(body));
        expect(response.body).toEqual(commandResult);
      });
    });
  });

  describe('Given POST /tickets/:id/attachments/presign endpoint', () => {
    describe('When called with a valid body', () => {
      test('Then it executes RequestTicketAttachmentUploadCommand with the ticket id and body and returns the result', async () => {
        const body = mockRequestAttachmentUploadRequestDto();
        const commandResult = {
          attachmentId: ATTACHMENT_ID,
          uploadUrl: 'https://s3.example.com/support-triage-attachments',
          uploadFields: { key: 'field-value' },
          objectKey: `tickets/${TICKET_ID}/${randomUUID()}-${body.filename}`,
        };
        mockCommandBus.execute.mockResolvedValue(commandResult);

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/attachments/presign`)
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
    describe('When called', () => {
      test('Then it executes CompleteTicketAttachmentUploadCommand with the ticket and attachment ids and returns the result', async () => {
        const commandResult = {
          id: ATTACHMENT_ID,
          kind: 'screenshot',
          mimeType: 'image/png',
          extractedText: 'Error 500',
          processingStatus: 'completed',
          processingError: null,
        };
        mockCommandBus.execute.mockResolvedValue(commandResult);

        const response = await request(app.getHttpServer())
          .post(`/tickets/${TICKET_ID}/attachments/${ATTACHMENT_ID}/complete`)
          .expect(201);

        expect(mockCommandBus.execute).toHaveBeenCalledWith(
          new CompleteTicketAttachmentUploadCommand(TICKET_ID, ATTACHMENT_ID),
        );
        expect(response.body).toEqual(commandResult);
      });
    });
  });

  describe('Given GET /tickets/:id endpoint', () => {
    describe('When called with an existing ticket id', () => {
      test('Then it executes GetTicketQuery with the ticket id and returns the query result', async () => {
        const queryResult = { id: TICKET_ID, subject: 'Checkout broken', attachments: [] };
        mockQueryBus.execute.mockResolvedValue(queryResult);

        const response = await request(app.getHttpServer()).get(`/tickets/${TICKET_ID}`).expect(200);

        expect(mockQueryBus.execute).toHaveBeenCalledWith(new GetTicketQuery(TICKET_ID));
        expect(response.body).toEqual(queryResult);
      });
    });
  });
});
