import { randomUUID } from 'node:crypto';

import { TestBed } from '@automock/jest';

import { ClassifyNode } from '../../../../../src/app/tickets/graph/nodes/classify.node';
import { TicketClassificationStepService } from '../../../../../src/app/tickets/orchestrator/steps/ticket-classification-step.service';
import { mockTicketInvestigationGraphState, mockTicketSelect } from '../../../../__mocks__';

const TICKET_ID = randomUUID();
const TICKET = mockTicketSelect({ id: TICKET_ID });
const ATTACHMENT_TEXT = 'Error 500: payment failed';
const STATE = mockTicketInvestigationGraphState({
  ticketId: TICKET_ID,
  ticket: TICKET,
  attachmentText: ATTACHMENT_TEXT,
});

describe('ClassifyNode Unit Test', () => {
  let sut: ClassifyNode;
  let classificationStep: jest.Mocked<TicketClassificationStepService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ClassifyNode).compile();

    sut = unit;
    classificationStep = unitRef.get(TicketClassificationStepService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    classificationStep.run.mockResolvedValue(undefined);
  });

  describe('Given run', () => {
    describe('When called', () => {
      test('Then it runs classification and returns no state update', async () => {
        const result = await sut.run(STATE);

        expect(classificationStep.run).toHaveBeenCalledWith(TICKET, ATTACHMENT_TEXT);
        expect(result).toEqual({});
      });
    });
  });
});
