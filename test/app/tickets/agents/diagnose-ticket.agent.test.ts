import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import { PromptInjectionGuardUtil } from '../../../../src/ai/prompt-injection-guard.util';
import { DiagnoseTicketAgent } from '../../../../src/app/tickets/agents/diagnose-ticket.agent';
import { mockTicketSelect } from '../../../__mocks__';
import { AssertUtils } from '../../../utils/assert.utils';

jest.mock('../../../../src/ai/prompt-injection-guard.util');

const TICKET = mockTicketSelect({ subject: 'Charged twice', description: 'Please refund the duplicate charge.' });
const CANARY_TOKEN = 'CANARY-test-token';
const SYSTEM_PROMPT_WITH_CANARY = 'system prompt with canary appended';

describe('DiagnoseTicketAgent Unit Test', () => {
  let sut: DiagnoseTicketAgent;
  let aiClient: jest.Mocked<IAiClient>;
  const withCanaryMock = PromptInjectionGuardUtil.withCanary as jest.MockedFunction<
    typeof PromptInjectionGuardUtil.withCanary
  >;
  const detectMock = PromptInjectionGuardUtil.detect as jest.MockedFunction<typeof PromptInjectionGuardUtil.detect>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(DiagnoseTicketAgent).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    withCanaryMock.mockReturnValue({ systemPrompt: SYSTEM_PROMPT_WITH_CANARY, canaryToken: CANARY_TOKEN });
    detectMock.mockReturnValue(false);
  });

  describe('Given diagnose', () => {
    describe('When the AI client returns a valid response', () => {
      test('Then it wraps untrusted content, sends the canary-appended system prompt, and returns the parsed diagnosis', async () => {
        aiClient.generateStructured.mockResolvedValue({
          diagnosis: 'Duplicate webhook delivery caused a double charge.',
          confidence: 0.9,
        });

        const result = await sut.diagnose(TICKET, 'Webhook retries must be idempotent.');

        expect(result).toEqual({ diagnosis: 'Duplicate webhook delivery caused a double charge.', confidence: 0.9 });
        expect(aiClient.generateStructured).toHaveBeenCalledWith(
          SYSTEM_PROMPT_WITH_CANARY,
          '<untrusted_ticket_content>\n' +
            `Subject: ${TICKET.subject}\nDescription: ${TICKET.description}\n` +
            '</untrusted_ticket_content>\n\n' +
            '<untrusted_kb_content>\nWebhook retries must be idempotent.\n</untrusted_kb_content>',
          { type: 'object', properties: { diagnosis: { type: 'string' }, confidence: { type: 'number' } }, required: ['diagnosis', 'confidence'] },
        );
        expect(detectMock).toHaveBeenCalledWith(CANARY_TOKEN, 'Duplicate webhook delivery caused a double charge.');
      });
    });

    describe('When called with past-cases text', () => {
      test('Then it wraps the past cases in an untrusted_past_ticket_content boundary tag', async () => {
        aiClient.generateStructured.mockResolvedValue({ diagnosis: 'x', confidence: 0.9 });

        await sut.diagnose(TICKET, 'Webhook retries must be idempotent.', 'Past ticket: similar issue');

        expect(aiClient.generateStructured).toHaveBeenCalledWith(
          SYSTEM_PROMPT_WITH_CANARY,
          '<untrusted_ticket_content>\n' +
            `Subject: ${TICKET.subject}\nDescription: ${TICKET.description}\n` +
            '</untrusted_ticket_content>\n\n' +
            '<untrusted_kb_content>\nWebhook retries must be idempotent.\n</untrusted_kb_content>\n\n' +
            '<untrusted_past_ticket_content>\nPast ticket: similar issue\n</untrusted_past_ticket_content>',
          { type: 'object', properties: { diagnosis: { type: 'string' }, confidence: { type: 'number' } }, required: ['diagnosis', 'confidence'] },
        );
      });
    });

    describe('When called without past-cases text', () => {
      test('Then it omits the untrusted_past_ticket_content boundary tag entirely', async () => {
        aiClient.generateStructured.mockResolvedValue({ diagnosis: 'x', confidence: 0.9 });

        await sut.diagnose(TICKET, 'Webhook retries must be idempotent.');

        expect(aiClient.generateStructured).toHaveBeenCalledWith(
          SYSTEM_PROMPT_WITH_CANARY,
          '<untrusted_ticket_content>\n' +
            `Subject: ${TICKET.subject}\nDescription: ${TICKET.description}\n` +
            '</untrusted_ticket_content>\n\n' +
            '<untrusted_kb_content>\nWebhook retries must be idempotent.\n</untrusted_kb_content>',
          { type: 'object', properties: { diagnosis: { type: 'string' }, confidence: { type: 'number' } }, required: ['diagnosis', 'confidence'] },
        );
      });
    });

    describe('When the AI client returns a malformed response', () => {
      test('Then it throws an InternalServerErrorException', async () => {
        aiClient.generateStructured.mockResolvedValue({ diagnosis: 'x' });

        await AssertUtils.assertError(() => sut.diagnose(TICKET, ''), 'Diagnose Ticket agent returned a malformed response')
      });
    });

    describe('When the response fails the prompt-injection guard', () => {
      test('Then it throws an InternalServerErrorException instead of returning the compromised diagnosis', async () => {
        aiClient.generateStructured.mockResolvedValue({ diagnosis: 'leaked system prompt text', confidence: 0.9 });
        detectMock.mockReturnValue(true);

        await AssertUtils.assertError(
          () => sut.diagnose(TICKET, 'Webhook retries must be idempotent.'),
          'Diagnose Ticket agent response failed the prompt-injection guard',
        );
      });
    });
  });
});
