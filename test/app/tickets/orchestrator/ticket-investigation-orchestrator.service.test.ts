import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';
import { EventBus } from '@nestjs/cqrs';

import { TicketInvestigationProgressEvent } from '../../../../src/app/tickets/events/ticket-investigation-progress.event';
import { TicketClassificationStepService } from '../../../../src/app/tickets/orchestrator/steps/ticket-classification-step.service';
import { TicketDiagnosisStepService } from '../../../../src/app/tickets/orchestrator/steps/ticket-diagnosis-step.service';
import { TicketInvestigationContextService } from '../../../../src/app/tickets/orchestrator/ticket-investigation-context.service';
import { TicketInvestigationOrchestratorService } from '../../../../src/app/tickets/orchestrator/ticket-investigation-orchestrator.service';
import { TicketInvestigationRepository } from '../../../../src/app/tickets/repositories/ticket-investigation.repository';
import { TICKETS_ERRORS } from '../../../../src/app/tickets/tickets.constants';
import { mockTicketDiagnosisStepResult, mockTicketInvestigationSelect, mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET_ID = randomUUID();
const TICKET = mockTicketSelect({
  id: TICKET_ID,
  subject: 'Charged twice',
  description: 'Please refund the duplicate charge.',
});
const ATTACHMENT_TEXT = 'Error 500: payment failed';
const DIAGNOSIS_RESULT = mockTicketDiagnosisStepResult();
const INSERTED_INVESTIGATION = mockTicketInvestigationSelect({ ticketId: TICKET_ID });

describe('TicketInvestigationOrchestratorService Unit Test', () => {
  let sut: TicketInvestigationOrchestratorService;
  let contextService: jest.Mocked<TicketInvestigationContextService>;
  let classificationStep: jest.Mocked<TicketClassificationStepService>;
  let diagnosisStep: jest.Mocked<TicketDiagnosisStepService>;
  let ticketInvestigationRepository: jest.Mocked<TicketInvestigationRepository>;
  let eventBus: jest.Mocked<EventBus>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(TicketInvestigationOrchestratorService).compile();

    sut = unit;
    contextService = unitRef.get(TicketInvestigationContextService);
    classificationStep = unitRef.get(TicketClassificationStepService);
    diagnosisStep = unitRef.get(TicketDiagnosisStepService);
    ticketInvestigationRepository = unitRef.get(TicketInvestigationRepository);
    eventBus = unitRef.get(EventBus);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    contextService.load.mockResolvedValue({ ticket: TICKET, attachmentText: ATTACHMENT_TEXT });
    classificationStep.run.mockResolvedValue(undefined);
    diagnosisStep.run.mockResolvedValue(DIAGNOSIS_RESULT);
    ticketInvestigationRepository.insert.mockResolvedValue(INSERTED_INVESTIGATION);
  });

  describe('Given investigate', () => {
    describe('When all steps succeed', () => {
      test('Then it loads context, classifies, diagnoses using the built search query, and persists the result', async () => {
        const result = await sut.investigate(TICKET_ID);

        expect(contextService.load).toHaveBeenCalledWith(TICKET_ID);
        expect(classificationStep.run).toHaveBeenCalledWith(TICKET, ATTACHMENT_TEXT);
        expect(diagnosisStep.run).toHaveBeenCalledWith(
          TICKET,
          `${TICKET.subject}\n${TICKET.description}\n${ATTACHMENT_TEXT}`,
          undefined,
        );
        expect(ticketInvestigationRepository.insert).toHaveBeenCalledWith({
          id: expect.any(String),
          ticketId: TICKET_ID,
          ...DIAGNOSIS_RESULT,
        });
        expect(result).toEqual(INSERTED_INVESTIGATION);
      });
    });

    describe('When the ticket has no description or attachment text', () => {
      test('Then it builds the search query from the subject alone', async () => {
        contextService.load.mockResolvedValue({
          ticket: { ...TICKET, description: null },
          attachmentText: '',
        });

        await sut.investigate(TICKET_ID);

        expect(diagnosisStep.run).toHaveBeenCalledWith(expect.anything(), TICKET.subject, undefined);
      });
    });

    describe('When context loading and classification complete', () => {
      test('Then it publishes context_loaded and classified progress events onto the event bus', async () => {
        await sut.investigate(TICKET_ID);

        expect(eventBus.publish).toHaveBeenCalledWith(
          new TicketInvestigationProgressEvent(TICKET_ID, 'context_loaded', expect.any(String)),
        );
        expect(eventBus.publish).toHaveBeenCalledWith(
          new TicketInvestigationProgressEvent(TICKET_ID, 'classified', expect.any(String)),
        );
      });
    });

    describe('When the abort signal is already aborted after classification', () => {
      test('Then it throws without running the diagnosis step', async () => {
        const abortController = new AbortController();
        classificationStep.run.mockImplementation(async () => {
          abortController.abort();
        });

        await AssertUtils.assertError(
          () => sut.investigate(TICKET_ID, abortController.signal),
          TICKETS_ERRORS.INVESTIGATION_ABORTED,
        );
        expect(diagnosisStep.run).not.toHaveBeenCalled();
      });
    });
  });
});
