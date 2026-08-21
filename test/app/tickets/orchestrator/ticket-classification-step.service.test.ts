import { TestBed } from '@automock/jest';

import { ClassifyTicketAgent } from '../../../../src/app/tickets/agents/classify-ticket.agent';
import { TicketClassificationStepService } from '../../../../src/app/tickets/orchestrator/steps/ticket-classification-step.service';
import { TicketClassificationRepository } from '../../../../src/app/tickets/repositories/ticket-classification.repository';
import { mockClassifyTicketResponse, mockTicketSelect } from '../../../__mocks__';

const TICKET = mockTicketSelect();
const ATTACHMENT_TEXT = 'Error 500: payment failed';

describe('TicketClassificationStepService Unit Test', () => {
  let sut: TicketClassificationStepService;
  let classifyTicketAgent: jest.Mocked<ClassifyTicketAgent>;
  let ticketClassificationRepository: jest.Mocked<TicketClassificationRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(TicketClassificationStepService).compile();

    sut = unit;
    classifyTicketAgent = unitRef.get(ClassifyTicketAgent);
    ticketClassificationRepository = unitRef.get(TicketClassificationRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given run', () => {
    describe('When classification succeeds', () => {
      test('Then it persists the classification with a generated id', async () => {
        const classification = mockClassifyTicketResponse();
        classifyTicketAgent.classify.mockResolvedValue(classification);

        await sut.run(TICKET, ATTACHMENT_TEXT);

        expect(classifyTicketAgent.classify).toHaveBeenCalledWith(TICKET, ATTACHMENT_TEXT);
        expect(ticketClassificationRepository.insert).toHaveBeenCalledWith({
          id: expect.any(String),
          ticketId: TICKET.id,
          category: classification.category,
          priority: classification.priority,
          confidence: classification.confidence,
        });
      });
    });

    describe('When classification fails', () => {
      test('Then it does not persist anything and does not throw', async () => {
        classifyTicketAgent.classify.mockRejectedValue(new Error('Gemini timed out'));

        await sut.run(TICKET, ATTACHMENT_TEXT);
        expect(ticketClassificationRepository.insert).not.toHaveBeenCalled();
      });
    });
  });
});
