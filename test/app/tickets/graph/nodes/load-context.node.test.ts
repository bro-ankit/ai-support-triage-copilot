import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { LoadContextNode } from '../../../../../src/app/tickets/graph/nodes/load-context.node';
import { TicketInvestigationContextService } from '../../../../../src/app/tickets/orchestrator/ticket-investigation-context.service';
import { mockTicketInvestigationGraphState, mockTicketSelect } from '../../../../__mocks__';

const TICKET_ID = randomUUID();
const TICKET = mockTicketSelect({
  id: TICKET_ID,
  subject: 'Charged twice',
  description: 'Please refund the duplicate charge.',
});
const ATTACHMENT_TEXT = 'Error 500: payment failed';

describe('LoadContextNode Unit Test', () => {
  let sut: LoadContextNode;
  let contextService: jest.Mocked<TicketInvestigationContextService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(LoadContextNode).compile();

    sut = unit;
    contextService = unitRef.get(TicketInvestigationContextService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    contextService.load.mockResolvedValue({ ticket: TICKET, attachmentText: ATTACHMENT_TEXT });
  });

  describe('Given run', () => {
    describe('When the ticket has a description and attachment text', () => {
      test('Then it loads the context and builds the search query from subject, description, and attachment text', async () => {
        const result = await sut.run(mockTicketInvestigationGraphState({ ticketId: TICKET_ID }));

        expect(contextService.load).toHaveBeenCalledWith(TICKET_ID);
        expect(result).toEqual({
          ticket: TICKET,
          attachmentText: ATTACHMENT_TEXT,
          searchQuery: `${TICKET.subject}\n${TICKET.description}\n${ATTACHMENT_TEXT}`,
        });
      });
    });

    describe('When the ticket has no description or attachment text', () => {
      test('Then it builds the search query from the subject alone', async () => {
        const ticketWithoutDescription = mockTicketSelect({
          id: TICKET_ID,
          subject: TICKET.subject,
          description: null,
        });
        contextService.load.mockResolvedValue({ ticket: ticketWithoutDescription, attachmentText: '' });

        const result = await sut.run(mockTicketInvestigationGraphState({ ticketId: TICKET_ID }));

        expect(result.searchQuery).toEqual(TICKET.subject);
      });
    });
  });
});
