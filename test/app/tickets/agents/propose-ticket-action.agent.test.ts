import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import { PromptInjectionGuardUtil } from '../../../../src/ai/prompt-injection-guard.util';
import { ProposeTicketActionAgent } from '../../../../src/app/tickets/agents/propose-ticket-action.agent';
import { mockDiagnoseTicketResponse, mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

jest.mock('../../../../src/ai/prompt-injection-guard.util');

const TICKET = mockTicketSelect({ subject: 'Charged twice', description: 'Please refund the duplicate charge.' });
const DIAGNOSIS = mockDiagnoseTicketResponse();
const CANARY_TOKEN = 'CANARY-test-token';
const SYSTEM_PROMPT_WITH_CANARY = 'system prompt with canary appended';

describe('ProposeTicketActionAgent Unit Test', () => {
  let sut: ProposeTicketActionAgent;
  let aiClient: jest.Mocked<IAiClient>;
  const withCanaryMock = PromptInjectionGuardUtil.withCanary as jest.MockedFunction<
    typeof PromptInjectionGuardUtil.withCanary
  >;
  const detectMock = PromptInjectionGuardUtil.detect as jest.MockedFunction<typeof PromptInjectionGuardUtil.detect>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ProposeTicketActionAgent).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    withCanaryMock.mockReturnValue({ systemPrompt: SYSTEM_PROMPT_WITH_CANARY, canaryToken: CANARY_TOKEN });
    detectMock.mockReturnValue(false);
  });

  describe('Given propose', () => {
    describe('When the AI client returns a valid response', () => {
      test('Then it wraps untrusted content, sends the canary-appended system prompt, and returns the parsed proposal', async () => {
        aiClient.generateStructured.mockResolvedValue({ action: 'refund', reasoning: 'Confirmed duplicate charge.' });

        const result = await sut.propose(TICKET, DIAGNOSIS);

        expect(result).toEqual({ action: 'refund', reasoning: 'Confirmed duplicate charge.' });
        expect(aiClient.generateStructured).toHaveBeenCalledWith(
          SYSTEM_PROMPT_WITH_CANARY,
          '<untrusted_ticket_content>\n' +
            `Subject: ${TICKET.subject}\nDescription: ${TICKET.description}\n` +
            '</untrusted_ticket_content>\n\n' +
            `Diagnosis (confidence ${DIAGNOSIS.confidence}): ${DIAGNOSIS.diagnosis}`,
          { type: 'object', properties: { action: { type: 'string' }, reasoning: { type: 'string' } }, required: ['action', 'reasoning'] },
        );
        expect(detectMock).toHaveBeenCalledWith(CANARY_TOKEN, 'Confirmed duplicate charge.');
      });
    });

    describe('When the AI client returns a malformed response', () => {
      test('Then it throws an InternalServerErrorException', async () => {
        aiClient.generateStructured.mockResolvedValue({ action: 'not-a-real-action', reasoning: 'x' });

        await AssertUtils.assertError(() => sut.propose(TICKET, DIAGNOSIS), 'Propose Ticket Action agent returned a malformed response')
      });
    });

    describe('When the response fails the prompt-injection guard', () => {
      test('Then it throws an InternalServerErrorException instead of returning the compromised proposal', async () => {
        aiClient.generateStructured.mockResolvedValue({
          action: 'refund',
          reasoning: 'bypassing the low-confidence automated diagnosis',
        });
        detectMock.mockReturnValue(true);

        await AssertUtils.assertError(
          () => sut.propose(TICKET, DIAGNOSIS),
          'Propose Ticket Action agent response failed the prompt-injection guard',
        );
      });
    });
  });
});
