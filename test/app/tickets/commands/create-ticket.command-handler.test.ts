import { TestBed } from '@automock/jest';

import { CreateTicketCommand } from '../../../../src/app/tickets/commands/create-ticket.command';
import { CreateTicketCommandHandler } from '../../../../src/app/tickets/commands/create-ticket.command-handler';
import { TicketRepository } from '../../../../src/app/tickets/repositories/ticket.repository';
import { mockCreateTicketRequestDto, mockTicketSelect } from '../../../__mocks__';

const REQUEST = mockCreateTicketRequestDto();
const INSERTED_TICKET = mockTicketSelect();

describe('CreateTicketCommandHandler Unit Test', () => {
  let sut: CreateTicketCommandHandler;
  let ticketRepository: jest.Mocked<TicketRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(CreateTicketCommandHandler).compile();

    sut = unit;
    ticketRepository = unitRef.get(TicketRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ticketRepository.insert.mockResolvedValue(INSERTED_TICKET);
  });

  describe('Given execute', () => {
    describe('When called with a valid request', () => {
      test('Then it inserts a ticket with a generated id and returns it with an empty attachments list', async () => {
        const result = await sut.execute(new CreateTicketCommand(REQUEST));

        expect(ticketRepository.insert.mock.calls).toEqual([
          [
            {
              id: expect.any(String),
              subject: REQUEST.subject,
              description: REQUEST.description,
              priority: REQUEST.priority,
            },
          ],
        ]);

        expect(result).toEqual({
          id: INSERTED_TICKET.id,
          subject: INSERTED_TICKET.subject,
          description: INSERTED_TICKET.description,
          status: INSERTED_TICKET.status,
          priority: INSERTED_TICKET.priority,
          attachments: [],
          createdAt: INSERTED_TICKET.createdAt,
        });
      });
    });
  });
});
