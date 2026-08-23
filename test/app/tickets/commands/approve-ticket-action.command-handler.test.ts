import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { ApproveTicketActionCommand } from '../../../../src/app/tickets/commands/approve-ticket-action.command';
import { ApproveTicketActionCommandHandler } from '../../../../src/app/tickets/commands/approve-ticket-action.command-handler';
import { TicketActionApprovalRepository } from '../../../../src/app/tickets/repositories/ticket-action-approval.repository';
import { TicketInvestigationRepository } from '../../../../src/app/tickets/repositories/ticket-investigation.repository';
import { TicketRepository } from '../../../../src/app/tickets/repositories/ticket.repository';
import { TICKETS_ERRORS } from '../../../../src/app/tickets/tickets.constants';
import { mockTicketActionApprovalSelect, mockTicketInvestigationSelect, mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET_ID = randomUUID();
const INVESTIGATION_ID = randomUUID();
const APPROVED_BY = 'approver-client-id';

describe('ApproveTicketActionCommandHandler Unit Test', () => {
  let sut: ApproveTicketActionCommandHandler;
  let ticketRepository: jest.Mocked<TicketRepository>;
  let ticketInvestigationRepository: jest.Mocked<TicketInvestigationRepository>;
  let ticketActionApprovalRepository: jest.Mocked<TicketActionApprovalRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ApproveTicketActionCommandHandler).compile();

    sut = unit;
    ticketRepository = unitRef.get(TicketRepository);
    ticketInvestigationRepository = unitRef.get(TicketInvestigationRepository);
    ticketActionApprovalRepository = unitRef.get(TicketActionApprovalRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ticketRepository.findById.mockResolvedValue(mockTicketSelect({ id: TICKET_ID }));
  });

  describe('Given a ticket that does not exist for the current tenant', () => {
    describe('When execute is called', () => {
      test('Then it throws NotFoundException without creating an approval', async () => {
        ticketRepository.findById.mockResolvedValue(undefined);

        await AssertUtils.assertError(
          async () => sut.execute(new ApproveTicketActionCommand(TICKET_ID, INVESTIGATION_ID, APPROVED_BY)),
          TICKETS_ERRORS.TICKET_NOT_FOUND(TICKET_ID),
          404,
        );
        expect(ticketRepository.findById).toHaveBeenCalledWith(TICKET_ID);
        expect(ticketActionApprovalRepository.insert).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given an investigation that does not belong to the ticket', () => {
    describe('When execute is called', () => {
      test('Then it throws NotFoundException without creating an approval', async () => {
        ticketInvestigationRepository.findById.mockResolvedValue(
          mockTicketInvestigationSelect({ id: INVESTIGATION_ID, ticketId: randomUUID() }),
        );

        await AssertUtils.assertError(
          async () => sut.execute(new ApproveTicketActionCommand(TICKET_ID, INVESTIGATION_ID, APPROVED_BY)),
          TICKETS_ERRORS.INVESTIGATION_NOT_FOUND(INVESTIGATION_ID),
          404,
        );
        expect(ticketInvestigationRepository.findById).toHaveBeenCalledWith(INVESTIGATION_ID);
        expect(ticketActionApprovalRepository.insert).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given an investigation with no proposed action', () => {
    describe('When execute is called', () => {
      test('Then it throws BadRequestException without creating an approval', async () => {
        ticketInvestigationRepository.findById.mockResolvedValue(
          mockTicketInvestigationSelect({ id: INVESTIGATION_ID, ticketId: TICKET_ID, proposedAction: null }),
        );

        await AssertUtils.assertError(
          async () => sut.execute(new ApproveTicketActionCommand(TICKET_ID, INVESTIGATION_ID, APPROVED_BY)),
          TICKETS_ERRORS.NO_PROPOSED_ACTION(INVESTIGATION_ID),
          400,
        );
        expect(ticketActionApprovalRepository.insert).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given a valid investigation with a proposed action', () => {
    describe('When execute is called', () => {
      test('Then it creates an approval recording who approved which action and returns it', async () => {
        const investigation = mockTicketInvestigationSelect({
          id: INVESTIGATION_ID,
          ticketId: TICKET_ID,
          proposedAction: 'refund',
        });
        ticketInvestigationRepository.findById.mockResolvedValue(investigation);
        const insertedApproval = mockTicketActionApprovalSelect({
          ticketInvestigationId: INVESTIGATION_ID,
          action: 'refund',
          approvedBy: APPROVED_BY,
        });
        ticketActionApprovalRepository.insert.mockResolvedValue(insertedApproval);

        const result = await sut.execute(new ApproveTicketActionCommand(TICKET_ID, INVESTIGATION_ID, APPROVED_BY));

        expect(ticketRepository.findById).toHaveBeenCalledWith(TICKET_ID);
        expect(ticketInvestigationRepository.findById).toHaveBeenCalledWith(INVESTIGATION_ID);
        expect(ticketActionApprovalRepository.insert).toHaveBeenCalledWith({
          id: expect.any(String),
          ticketInvestigationId: INVESTIGATION_ID,
          action: 'refund',
          approvedBy: APPROVED_BY,
          expiresAt: expect.any(Date),
        });
        expect(result).toEqual({
          id: insertedApproval.id,
          ticketInvestigationId: insertedApproval.ticketInvestigationId,
          action: insertedApproval.action,
          approvedBy: insertedApproval.approvedBy,
          approvedAt: insertedApproval.approvedAt,
          expiresAt: insertedApproval.expiresAt,
        });
      });
    });
  });
});
