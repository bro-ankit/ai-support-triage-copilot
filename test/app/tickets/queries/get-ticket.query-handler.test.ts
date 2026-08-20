import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { GetTicketQuery } from '../../../../src/app/tickets/queries/get-ticket.query';
import { GetTicketQueryHandler } from '../../../../src/app/tickets/queries/get-ticket.query-handler';
import { TicketAttachmentRepository } from '../../../../src/app/tickets/repositories/ticket-attachment.repository';
import { TicketRepository } from '../../../../src/app/tickets/repositories/ticket.repository';
import { mockTicketAttachmentSelect, mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET_ID = randomUUID();
const TICKET = mockTicketSelect({ id: TICKET_ID });
const ATTACHMENT = mockTicketAttachmentSelect({ ticketId: TICKET_ID });

describe('GetTicketQueryHandler Unit Test', () => {
  let sut: GetTicketQueryHandler;
  let ticketRepository: jest.Mocked<TicketRepository>;
  let ticketAttachmentRepository: jest.Mocked<TicketAttachmentRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(GetTicketQueryHandler).compile();

    sut = unit;
    ticketRepository = unitRef.get(TicketRepository);
    ticketAttachmentRepository = unitRef.get(TicketAttachmentRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given execute', () => {
    describe('When the ticket exists', () => {
      test('Then it returns the ticket with its attachments', async () => {
        ticketRepository.findById.mockResolvedValue(TICKET);
        ticketAttachmentRepository.findByTicketId.mockResolvedValue([ATTACHMENT]);

        const result = await sut.execute(new GetTicketQuery(TICKET_ID));

        expect(ticketAttachmentRepository.findByTicketId).toHaveBeenCalledWith(TICKET_ID);
        expect(result).toEqual({
          id: TICKET.id,
          subject: TICKET.subject,
          description: TICKET.description,
          status: TICKET.status,
          priority: TICKET.priority,
          createdAt: TICKET.createdAt,
          attachments: [
            {
              id: ATTACHMENT.id,
              kind: ATTACHMENT.kind,
              mimeType: ATTACHMENT.mimeType,
              extractedText: ATTACHMENT.extractedText,
              processingStatus: ATTACHMENT.processingStatus,
              processingError: ATTACHMENT.processingError,
            },
          ],
        });
      });
    });

    describe('When the ticket does not exist', () => {
      test('Then it throws NotFoundException without fetching attachments', async () => {
        ticketRepository.findById.mockResolvedValue(undefined);

        await AssertUtils.assertError(
          () => sut.execute(new GetTicketQuery(TICKET_ID)),
          `Ticket ${TICKET_ID} not found`,
          404,
        );
        expect(ticketAttachmentRepository.findByTicketId).not.toHaveBeenCalled();
      });
    });
  });
});
