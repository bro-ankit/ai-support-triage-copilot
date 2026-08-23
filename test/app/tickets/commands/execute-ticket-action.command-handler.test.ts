import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { ExecuteTicketActionCommand } from '../../../../src/app/tickets/commands/execute-ticket-action.command';
import { ExecuteTicketActionCommandHandler } from '../../../../src/app/tickets/commands/execute-ticket-action.command-handler';
import { TicketActionApprovalRepository } from '../../../../src/app/tickets/repositories/ticket-action-approval.repository';
import { TicketInvestigationRepository } from '../../../../src/app/tickets/repositories/ticket-investigation.repository';
import { TicketRepository } from '../../../../src/app/tickets/repositories/ticket.repository';
import { TICKETS_ERRORS } from '../../../../src/app/tickets/tickets.constants';
import { DrizzleTransactionService } from '../../../../src/database/drizzle-transaction.service';
import { mockTicketActionApprovalSelect, mockTicketInvestigationSelect, mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET_ID = randomUUID();
const INVESTIGATION_ID = randomUUID();

describe('ExecuteTicketActionCommandHandler Unit Test', () => {
  let sut: ExecuteTicketActionCommandHandler;
  let dbTransactionService: jest.Mocked<DrizzleTransactionService>;
  let ticketRepository: jest.Mocked<TicketRepository>;
  let ticketInvestigationRepository: jest.Mocked<TicketInvestigationRepository>;
  let ticketActionApprovalRepository: jest.Mocked<TicketActionApprovalRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ExecuteTicketActionCommandHandler).compile();

    sut = unit;
    dbTransactionService = unitRef.get(DrizzleTransactionService);
    ticketRepository = unitRef.get(TicketRepository);
    ticketInvestigationRepository = unitRef.get(TicketInvestigationRepository);
    ticketActionApprovalRepository = unitRef.get(TicketActionApprovalRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dbTransactionService.execute.mockImplementation((fn: () => Promise<unknown>) => fn() as Promise<never>);
    ticketRepository.findById.mockResolvedValue(mockTicketSelect({ id: TICKET_ID }));
    ticketInvestigationRepository.findById.mockResolvedValue(
      mockTicketInvestigationSelect({ id: INVESTIGATION_ID, ticketId: TICKET_ID }),
    );
  });

  describe('Given a ticket that does not exist for the current tenant', () => {
    describe('When execute is called', () => {
      test('Then it throws NotFoundException', async () => {
        ticketRepository.findById.mockResolvedValue(undefined);

        await AssertUtils.assertError(
          async () => sut.execute(new ExecuteTicketActionCommand(TICKET_ID, INVESTIGATION_ID)),
          TICKETS_ERRORS.TICKET_NOT_FOUND(TICKET_ID),
          404,
        );
        expect(ticketRepository.findById).toHaveBeenCalledWith(TICKET_ID);
      });
    });
  });

  describe('Given no approval was ever created for the investigation', () => {
    describe('When execute is called', () => {
      test('Then it throws ConflictException without attempting to consume anything', async () => {
        ticketActionApprovalRepository.findLatestByInvestigationId.mockResolvedValue(undefined);

        await AssertUtils.assertError(
          async () => sut.execute(new ExecuteTicketActionCommand(TICKET_ID, INVESTIGATION_ID)),
          TICKETS_ERRORS.NO_APPROVAL(INVESTIGATION_ID),
          409,
        );
        expect(ticketInvestigationRepository.findById).toHaveBeenCalledWith(INVESTIGATION_ID);
        expect(ticketActionApprovalRepository.findLatestByInvestigationId).toHaveBeenCalledWith(INVESTIGATION_ID);
        expect(ticketActionApprovalRepository.consumeIfActive).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given the approval exists but is already expired or consumed', () => {
    describe('When execute is called', () => {
      test('Then it throws ConflictException and does not transition the investigation status', async () => {
        const approval = mockTicketActionApprovalSelect({ ticketInvestigationId: INVESTIGATION_ID });
        ticketActionApprovalRepository.findLatestByInvestigationId.mockResolvedValue(approval);
        ticketActionApprovalRepository.consumeIfActive.mockResolvedValue(undefined);

        await AssertUtils.assertError(
          async () => sut.execute(new ExecuteTicketActionCommand(TICKET_ID, INVESTIGATION_ID)),
          TICKETS_ERRORS.APPROVAL_NOT_CONSUMABLE(approval.id),
          409,
        );
        expect(ticketActionApprovalRepository.consumeIfActive).toHaveBeenCalledWith(approval.id);
        expect(ticketInvestigationRepository.updateStatus).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given a valid, unconsumed, unexpired approval', () => {
    describe('When execute is called', () => {
      test('Then it atomically consumes the approval and transitions the investigation to action_executed', async () => {
        const approval = mockTicketActionApprovalSelect({ ticketInvestigationId: INVESTIGATION_ID });
        ticketActionApprovalRepository.findLatestByInvestigationId.mockResolvedValue(approval);
        ticketActionApprovalRepository.consumeIfActive.mockResolvedValue({ ...approval, consumedAt: new Date() });
        const executedInvestigation = mockTicketInvestigationSelect({
          id: INVESTIGATION_ID,
          ticketId: TICKET_ID,
          status: 'action_executed',
        });
        ticketInvestigationRepository.updateStatus.mockResolvedValue(executedInvestigation);

        const result = await sut.execute(new ExecuteTicketActionCommand(TICKET_ID, INVESTIGATION_ID));

        expect(ticketActionApprovalRepository.consumeIfActive).toHaveBeenCalledWith(approval.id);
        expect(ticketInvestigationRepository.updateStatus).toHaveBeenCalledWith(INVESTIGATION_ID, 'action_executed');
        expect(result).toEqual({
          id: executedInvestigation.id,
          retrievedChunkIds: executedInvestigation.retrievedChunkIds,
          diagnosis: executedInvestigation.diagnosis,
          diagnosisConfidence: executedInvestigation.diagnosisConfidence,
          proposedAction: executedInvestigation.proposedAction,
          proposedActionReasoning: executedInvestigation.proposedActionReasoning,
          status: 'action_executed',
          createdAt: executedInvestigation.createdAt,
        });
      });
    });
  });
});
