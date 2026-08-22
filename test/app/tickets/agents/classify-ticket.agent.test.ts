import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import {
  CLASSIFY_TICKET_SYSTEM_PROMPT,
  ClassifyTicketAgent,
} from '../../../../src/app/tickets/agents/classify-ticket.agent';
import { mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET = mockTicketSelect({ subject: 'Charged twice', description: 'Please refund the duplicate charge.' });

describe('ClassifyTicketAgent Unit Test', () => {
  let sut: ClassifyTicketAgent;
  let aiClient: jest.Mocked<IAiClient>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ClassifyTicketAgent).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given classify', () => {
    describe('When the AI client returns a valid response', () => {
      test('Then it wraps the untrusted ticket content and returns the parsed classification', async () => {
        aiClient.generateStructured.mockResolvedValue({ category: 'billing', priority: 'high', confidence: 0.9 });

        const result = await sut.classify(TICKET, 'Order #4821');

        expect(result).toEqual({ category: 'billing', priority: 'high', confidence: 0.9 });
        expect(aiClient.generateStructured).toHaveBeenCalledWith(
          CLASSIFY_TICKET_SYSTEM_PROMPT,
          '<untrusted_ticket_content>\n' +
            `Subject: ${TICKET.subject}\n` +
            `Description: ${TICKET.description}\n` +
            'Attachment text: Order #4821\n' +
            '</untrusted_ticket_content>',
          {
            type: 'object',
            properties: {
              category: { type: 'string' },
              priority: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: ['category', 'priority', 'confidence'],
          },
        );
      });
    });

    describe('When the AI client returns a malformed response', () => {
      test('Then it throws an InternalServerErrorException', async () => {
        aiClient.generateStructured.mockResolvedValue({ category: 'not-a-category', priority: 'high', confidence: 0.9 });

        await AssertUtils.assertError(() => sut.classify(TICKET, ''), 'Classify Ticket agent returned a malformed response')
      });
    });
  });
});
