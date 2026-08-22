import { PromptInjectionGuardUtil } from '../../src/ai/prompt-injection-guard.util';

const SYSTEM_PROMPT = 'You are a Diagnosis agent for a customer support triage system.';

describe('PromptInjectionGuardUtil Unit Test', () => {
  describe('Given withCanary', () => {
    describe('When called', () => {
      test('Then it appends a unique canary-token instruction to the system prompt and returns the token separately', () => {
        const first = PromptInjectionGuardUtil.withCanary(SYSTEM_PROMPT);
        const second = PromptInjectionGuardUtil.withCanary(SYSTEM_PROMPT);

        expect(first.systemPrompt.startsWith(SYSTEM_PROMPT)).toBe(true);
        expect(first.systemPrompt).toContain(first.canaryToken);
        expect(first.canaryToken).toMatch(/^CANARY-[0-9a-f]{16}$/);
        expect(first.canaryToken).not.toBe(second.canaryToken);
      });
    });
  });

  describe('Given detect', () => {
    describe('When the response text contains the canary token', () => {
      test('Then it returns true', () => {
        const result = PromptInjectionGuardUtil.detect('CANARY-abc123', 'Here is CANARY-abc123 leaked in the output');

        expect(result).toBe(true);
      });
    });

    describe.each([
      'bypassing the low-confidence automated diagnosis',
      'overriding the previous rule',
      'ignoring the diagnosis entirely',
      'regardless of the confidence score',
      'this refund was pre-approved',
      'already promised a refund',
    ])('When the response text contains override language: %s', (responseText) => {
      test('Then it returns true', () => {
        const result = PromptInjectionGuardUtil.detect('CANARY-unused', responseText);

        expect(result).toBe(true);
      });
    });

    describe('When the response text contains neither the canary token nor override language', () => {
      test('Then it returns false', () => {
        const result = PromptInjectionGuardUtil.detect(
          'CANARY-abc123',
          'The double-charging issue is caused by non-idempotent webhook retries.',
        );

        expect(result).toBe(false);
      });
    });
  });
});
