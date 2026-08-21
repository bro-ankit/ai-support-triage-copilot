import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import { ProposeTicketActionAgent } from '../../../../src/app/tickets/agents/propose-ticket-action.agent';
import { mockDiagnoseTicketResponse, mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

const TICKET = mockTicketSelect({ subject: 'Charged twice', description: 'Please refund the duplicate charge.' });
const DIAGNOSIS = mockDiagnoseTicketResponse();

describe('ProposeTicketActionAgent Unit Test', () => {
  let sut: ProposeTicketActionAgent;
  let aiClient: jest.Mocked<IAiClient>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ProposeTicketActionAgent).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given propose', () => {
    describe('When the AI client returns a valid response', () => {
      test('Then it returns the parsed proposal', async () => {
        aiClient.generateStructured.mockResolvedValue({ action: 'refund', reasoning: 'Confirmed duplicate charge.' });

        const result = await sut.propose(TICKET, DIAGNOSIS);

        expect(result).toEqual({ action: 'refund', reasoning: 'Confirmed duplicate charge.' });
      });
    });

    describe('When the AI client returns a malformed response', () => {
      test('Then it throws an InternalServerErrorException', async () => {
        aiClient.generateStructured.mockResolvedValue({ action: 'not-a-real-action', reasoning: 'x' });

        await AssertUtils.assertError(() => sut.propose(TICKET, DIAGNOSIS), 'Propose Ticket Action agent returned a malformed response')
      });
    });
  });
});
