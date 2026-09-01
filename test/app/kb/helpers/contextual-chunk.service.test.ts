import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../../src/ai/ai.constants';
import type { IAiClient } from '../../../../src/ai/ai.interface';
import { PromptInjectionGuardUtil } from '../../../../src/ai/prompt-injection-guard.util';
import { ContextualChunkService } from '../../../../src/app/kb/helpers/contextual-chunk.service';

jest.mock('../../../../src/ai/prompt-injection-guard.util');

const FULL_DOCUMENT = 'Full postmortem document about duplicate charges.';
const CHUNK = { chunkIndex: 0, content: 'The webhook handler retried without idempotency checks.' };
const CANARY_TOKEN = 'CANARY-test-token';
const SYSTEM_PROMPT_WITH_CANARY = 'system prompt with canary appended';

describe('ContextualChunkService Unit Test', () => {
  let sut: ContextualChunkService;
  let aiClient: jest.Mocked<IAiClient>;
  const withCanaryMock = PromptInjectionGuardUtil.withCanary as jest.MockedFunction<
    typeof PromptInjectionGuardUtil.withCanary
  >;
  const detectMock = PromptInjectionGuardUtil.detect as jest.MockedFunction<typeof PromptInjectionGuardUtil.detect>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ContextualChunkService).compile();

    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    withCanaryMock.mockReturnValue({ systemPrompt: SYSTEM_PROMPT_WITH_CANARY, canaryToken: CANARY_TOKEN });
    detectMock.mockReturnValue(false);
  });

  describe('Given enrichChunks', () => {
    describe('When generation succeeds and passes the injection guard', () => {
      test('Then it wraps the document and chunk as untrusted content and prepends the generated context to the chunk', async () => {
        aiClient.generateText.mockResolvedValue('This chunk describes the root cause of the duplicate charges.');

        const result = await sut.enrichChunks(FULL_DOCUMENT, [CHUNK]);

        expect(result).toEqual([
          {
            chunkIndex: 0,
            content: `This chunk describes the root cause of the duplicate charges.\n\n${CHUNK.content}`,
          },
        ]);
        expect(aiClient.generateText).toHaveBeenCalledWith(
          SYSTEM_PROMPT_WITH_CANARY,
          '<untrusted_kb_content>\n' +
            `Full document:\n${FULL_DOCUMENT}\n` +
            '</untrusted_kb_content>\n\n' +
            '<untrusted_kb_content>\n' +
            `Chunk:\n${CHUNK.content}\n` +
            '</untrusted_kb_content>',
        );
      });
    });

    describe('When the generated context fails the injection guard', () => {
      test('Then it falls back to the chunk unmodified', async () => {
        aiClient.generateText.mockResolvedValue('leaked the canary or used override language');
        detectMock.mockReturnValue(true);

        const result = await sut.enrichChunks(FULL_DOCUMENT, [CHUNK]);

        expect(result).toEqual([CHUNK]);
      });
    });

    describe('When the AI client call throws', () => {
      test('Then it falls back to the chunk unmodified', async () => {
        aiClient.generateText.mockRejectedValue(new Error('upstream error'));

        const result = await sut.enrichChunks(FULL_DOCUMENT, [CHUNK]);

        expect(result).toEqual([CHUNK]);
      });
    });
  });
});
