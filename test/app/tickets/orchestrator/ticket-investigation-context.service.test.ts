import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { TicketInvestigationContextService } from '../../../../src/app/tickets/orchestrator/ticket-investigation-context.service';
import { TicketRepository } from '../../../../src/app/tickets/repositories/ticket.repository';
import { TICKETS_ERRORS } from '../../../../src/app/tickets/tickets.constants';
import { mockDynamicTicket, mockTicketAttachmentSelect, mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET_ID = randomUUID();
const TICKET = mockTicketSelect({ id: TICKET_ID });

describe('TicketInvestigationContextService Unit Test', () => {
  let sut: TicketInvestigationContextService;
  let ticketRepository: jest.Mocked<TicketRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(TicketInvestigationContextService).compile();

    sut = unit;
    ticketRepository = unitRef.get(TicketRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given load', () => {
    describe('When the ticket exists with completed attachments that have extracted text', () => {
      test('Then it returns the ticket with the completed attachment text joined', async () => {
        const completedAttachment = mockTicketAttachmentSelect({
          ticketId: TICKET_ID,
          processingStatus: 'completed',
          extractedText: 'Error 500: payment failed',
        });
        const pendingAttachment = mockTicketAttachmentSelect({
          ticketId: TICKET_ID,
          processingStatus: 'pending',
          extractedText: null,
        });
        ticketRepository.findById.mockResolvedValue(
          mockDynamicTicket({ attachments: true }, { ...TICKET, attachments: [completedAttachment, pendingAttachment] }),
        );

        const result = await sut.load(TICKET_ID);

        expect(result).toEqual({ ticket: TICKET, attachmentText: 'Error 500: payment failed' });
      });
    });

    describe('When the ticket exists with no attachments', () => {
      test('Then it returns the ticket with empty attachment text', async () => {
        ticketRepository.findById.mockResolvedValue(mockDynamicTicket({ attachments: true }, { ...TICKET }));

        const result = await sut.load(TICKET_ID);

        expect(result).toEqual({ ticket: TICKET, attachmentText: '' });
      });
    });

    describe('When the ticket does not exist', () => {
      test('Then it throws NotFoundException', async () => {
        ticketRepository.findById.mockResolvedValue(undefined);

        await AssertUtils.assertError(() => sut.load(TICKET_ID), TICKETS_ERRORS.TICKET_NOT_FOUND(TICKET_ID), 404);
      });
    });
  });
});
