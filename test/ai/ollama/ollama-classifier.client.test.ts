import { TestBed } from '@automock/jest';
import { ConfigService } from '@nestjs/config';

import { OllamaClassifierClient } from '../../../src/ai/ollama/ollama-classifier.client';
import { OLLAMA_DEFAULTS, OLLAMA_ERRORS } from '../../../src/ai/ollama/ollama.constants';
import { AssertUtils } from '../../utils/assert.utils';

const SYSTEM_PROMPT = 'Classify the ticket.';
const USER_CONTENT = '<untrusted_ticket_content>\nSubject: X\n</untrusted_ticket_content>';
const RAW_TEXT = '{"category":"billing","priority":"high","confidence":1}';

describe('OllamaClassifierClient Unit Test', () => {
  let sut: OllamaClassifierClient;
  const mockFetch = jest.fn();

  beforeAll(() => {
    const { unit } = TestBed.create(OllamaClassifierClient)
      .mock(ConfigService)
      .using({ get: (_key: string, defaultValue?: unknown) => defaultValue })
      .compile();

    sut = unit;
    global.fetch = mockFetch as never;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given classify', () => {
    describe('When Ollama returns a successful response', () => {
      test('Then it posts to the generate endpoint and returns the raw text with latency', async () => {
        mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ response: RAW_TEXT }) });

        const result = await sut.classify(SYSTEM_PROMPT, USER_CONTENT);

        expect(result.rawText).toEqual(RAW_TEXT);
        expect(typeof result.latencyMs).toEqual('number');
        expect(mockFetch).toHaveBeenCalledWith(`${OLLAMA_DEFAULTS.BASE_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OLLAMA_DEFAULTS.CLASSIFIER_MODEL,
            prompt: `${SYSTEM_PROMPT}\n\n${USER_CONTENT}`,
            stream: false,
          }),
        });
      });
    });

    describe('When Ollama returns a non-ok HTTP status', () => {
      test('Then it throws an InternalServerErrorException', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) });

        await AssertUtils.assertError(() => sut.classify(SYSTEM_PROMPT, USER_CONTENT), OLLAMA_ERRORS.REQUEST_FAILED);
      });
    });

    describe('When the request itself fails', () => {
      test('Then it throws an InternalServerErrorException', async () => {
        mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

        await AssertUtils.assertError(() => sut.classify(SYSTEM_PROMPT, USER_CONTENT), OLLAMA_ERRORS.REQUEST_FAILED);
      });
    });
  });
});
