import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { InvestigateTicketCommand } from '../../../../src/app/tickets/commands/investigate-ticket.command';
import { InvestigateTicketCommandHandler } from '../../../../src/app/tickets/commands/investigate-ticket.command-handler';
import { TicketInvestigationOrchestratorService } from '../../../../src/app/tickets/orchestrator/ticket-investigation-orchestrator.service';
import { mockTicketInvestigationSelect } from '../../../__mocks__';

const TICKET_ID = randomUUID();
const INVESTIGATION = mockTicketInvestigationSelect({ ticketId: TICKET_ID });

describe('InvestigateTicketCommandHandler Unit Test', () => {
  let sut: InvestigateTicketCommandHandler;
  let orchestrator: jest.Mocked<TicketInvestigationOrchestratorService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(InvestigateTicketCommandHandler).compile();

    sut = unit;
    orchestrator = unitRef.get(TicketInvestigationOrchestratorService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator.investigate.mockResolvedValue(INVESTIGATION);
  });

  describe('Given execute', () => {
    describe('When called with a valid ticket id and no abort signal', () => {
      test('Then it runs the investigation and returns the mapped response', async () => {
        const result = await sut.execute(new InvestigateTicketCommand(TICKET_ID));

        expect(orchestrator.investigate).toHaveBeenCalledWith(TICKET_ID, undefined);
        expect(result).toEqual({
          id: INVESTIGATION.id,
          retrievedChunkIds: INVESTIGATION.retrievedChunkIds,
          diagnosis: INVESTIGATION.diagnosis,
          diagnosisConfidence: INVESTIGATION.diagnosisConfidence,
          proposedAction: INVESTIGATION.proposedAction,
          proposedActionReasoning: INVESTIGATION.proposedActionReasoning,
          status: INVESTIGATION.status,
          createdAt: INVESTIGATION.createdAt,
        });
      });
    });

    describe('When called with an abort signal', () => {
      test('Then it forwards the abort signal to the orchestrator', async () => {
        const abortController = new AbortController();

        await sut.execute(new InvestigateTicketCommand(TICKET_ID, abortController.signal));

        expect(orchestrator.investigate).toHaveBeenCalledWith(TICKET_ID, abortController.signal);
      });
    });
  });
});
