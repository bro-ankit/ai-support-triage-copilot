import { TestBed } from '@automock/jest';

import { OllamaClassifierClient } from '../../../../src/ai/ollama/ollama-classifier.client';
import { OllamaTicketClassifier } from '../../../../src/app/tickets/classification/ollama-ticket-classifier';
import { mockTicketSelect } from '../../../__mocks__';

const TICKET = mockTicketSelect();
const ATTACHMENT_TEXT = 'attachment text';

describe('OllamaTicketClassifier Unit Test', () => {
  let sut: OllamaTicketClassifier;
  let ollamaClassifierClient: jest.Mocked<OllamaClassifierClient>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(OllamaTicketClassifier).compile();

    sut = unit;
    ollamaClassifierClient = unitRef.get(OllamaClassifierClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Given classify', () => {
    describe('When the local model returns a valid, schema-conformant response', () => {
      test('Then it returns the parsed result', async () => {
        ollamaClassifierClient.classify.mockResolvedValue({
          rawText: JSON.stringify({ category: 'billing', priority: 'high', confidence: 1 }),
          latencyMs: 10,
        });

        const result = await sut.classify(TICKET, ATTACHMENT_TEXT);

        expect(result).toEqual({ category: 'billing', priority: 'high', confidence: 1 });
      });
    });

    describe('When the local model returns malformed JSON', () => {
      test('Then it returns null', async () => {
        ollamaClassifierClient.classify.mockResolvedValue({ rawText: 'not json', latencyMs: 10 });

        const result = await sut.classify(TICKET, ATTACHMENT_TEXT);

        expect(result).toBeNull();
      });
    });

    describe('When the local model returns a response failing schema validation', () => {
      test('Then it returns null', async () => {
        ollamaClassifierClient.classify.mockResolvedValue({
          rawText: JSON.stringify({ category: 'not-a-category', priority: 'high', confidence: 1 }),
          latencyMs: 10,
        });

        const result = await sut.classify(TICKET, ATTACHMENT_TEXT);

        expect(result).toBeNull();
      });
    });

    describe('When the request itself fails', () => {
      test('Then it returns null', async () => {
        ollamaClassifierClient.classify.mockRejectedValue(new Error('ECONNREFUSED'));

        const result = await sut.classify(TICKET, ATTACHMENT_TEXT);

        expect(result).toBeNull();
      });
    });
  });
});
