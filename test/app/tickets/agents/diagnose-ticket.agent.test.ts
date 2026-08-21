import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import { DiagnoseTicketAgent } from '../../../../src/app/tickets/agents/diagnose-ticket.agent';
import { mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET = mockTicketSelect({ subject: 'Charged twice', description: 'Please refund the duplicate charge.' });

describe('DiagnoseTicketAgent Unit Test', () => {
  let sut: DiagnoseTicketAgent;
  let aiClient: jest.Mocked<IAiClient>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(DiagnoseTicketAgent).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given diagnose', () => {
    describe('When the AI client returns a valid response', () => {
      test('Then it returns the parsed diagnosis', async () => {
        aiClient.generateStructured.mockResolvedValue({
          diagnosis: 'Duplicate webhook delivery caused a double charge.',
          confidence: 0.9,
        });

        const result = await sut.diagnose(TICKET, 'Webhook retries must be idempotent.');

        expect(result).toEqual({ diagnosis: 'Duplicate webhook delivery caused a double charge.', confidence: 0.9 });
      });
    });

    describe('When the AI client returns a malformed response', () => {
      test('Then it throws an InternalServerErrorException', async () => {
        aiClient.generateStructured.mockResolvedValue({ diagnosis: 'x' });

        await AssertUtils.assertError(() => sut.diagnose(TICKET, ''), 'Diagnose Ticket agent returned a malformed response')
      });
    });
  });
});
