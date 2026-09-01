import { TestBed } from '@automock/jest';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AgentMessage, AgentTool, AiResponseSchema } from '../../../src/ai/ai.interface';
import { GeminiClient } from '../../../src/ai/gemini/gemini.client';
import { GEMINI_CLIENT } from '../../../src/ai/gemini/gemini.constants';
import { AiUsageContextService } from '../../../src/metrics/ai-usage-context.service';
import { MetricsReporter } from '../../../src/metrics/metrics.reporter';
import { AssertUtils } from '../../utils/assert.utils';

const PROMPT = 'Extract structured data from this ticket.';
const SAMPLE_TEXT = 'checkout button does nothing when clicked on mobile';
const SYSTEM_PROMPT = 'Answer only from the provided context.';
const USER_MESSAGE = 'What is the likely cause of this issue?';
const LLM_ANSWER = 'A missing onClick handler on the mobile checkout button.';

const AGENT_SYSTEM_PROMPT = 'You are a support triage agent. Use the provided tools to investigate.';
const AGENT_HISTORY: AgentMessage[] = [{ role: 'user', text: 'What do we know about this ticket?' }];
const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'searchKb',
    description: 'Search the KB semantically.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
];

const INPUT_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    category: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['category', 'tags'],
};

const EXPECTED_GEMINI_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    category: { type: SchemaType.STRING },
    tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['category', 'tags'],
};

const PARSED_RESPONSE = { category: 'billing', tags: ['refund'] };
const SAMPLE_EMBEDDING = [0.1, 0.2, 0.3, 0.4];
const IMAGE_BUFFER = Buffer.from('fake-png-bytes');
const AUDIO_BUFFER = Buffer.from('fake-audio-bytes');
const OCR_TEXT = 'Error 500: Payment failed';
const TRANSCRIPT_TEXT = 'The checkout page keeps crashing on my phone.';
const PDF_BUFFER = Buffer.from('fake-pdf-bytes');
const DOCUMENT_TEXT = 'Postmortem: duplicate charges caused by non-idempotent webhook retries.';

describe('GeminiClient Unit Test', () => {
  let sut: GeminiClient;
  let geminiClient: jest.Mocked<GoogleGenerativeAI>;
  let metricsReporter: jest.Mocked<MetricsReporter>;
  let usageContext: jest.Mocked<AiUsageContextService>;

  const mockGenerateContent = jest.fn();
  const mockEmbedContent = jest.fn();
  const mockSendMessage = jest.fn();
  const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
  const mockGenerateContentStream = jest.fn();

  const asyncIterableOf = <T>(items: T[]): AsyncIterable<T> => ({
    [Symbol.asyncIterator]: async function* () {
      for (const item of items) yield item;
    },
  });

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(GeminiClient)
      .mock(ConfigService)
      .using({ get: (_key: string, defaultValue?: unknown) => defaultValue })
      .compile();

    sut = unit;
    geminiClient = unitRef.get<GoogleGenerativeAI>(GEMINI_CLIENT);
    metricsReporter = unitRef.get(MetricsReporter);
    usageContext = unitRef.get(AiUsageContextService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    geminiClient.getGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
      embedContent: mockEmbedContent,
      startChat: mockStartChat,
      generateContentStream: mockGenerateContentStream,
    } as never);
    usageContext.getOperation.mockReturnValue(undefined);
  });

  describe('Given generateStructured', () => {
    describe('When Gemini returns valid JSON', () => {
      test('Then it calls the model with the mapped schema and returns the parsed object', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => JSON.stringify(PARSED_RESPONSE) },
        });

        const result = await sut.generateStructured(SYSTEM_PROMPT, PROMPT, INPUT_SCHEMA);

        expect(result).toEqual(PARSED_RESPONSE);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({
          model: 'gemini-3.5-flash',
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: EXPECTED_GEMINI_SCHEMA,
          },
        });
        expect(mockGenerateContent).toHaveBeenCalledWith(PROMPT);
      });
    });

    describe('When the Gemini API call throws', () => {
      test('Then it throws 500 with "Gemini API call failed"', async () => {
        mockGenerateContent.mockRejectedValueOnce(new Error('Connection timeout'));

        await AssertUtils.assertError(
          () => sut.generateStructured(SYSTEM_PROMPT, PROMPT, INPUT_SCHEMA),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });

    describe('When Gemini returns a non-JSON string', () => {
      test('Then it throws 500 with "Gemini returned non-JSON response"', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => 'not valid json {{' },
        });

        await AssertUtils.assertError(
          () => sut.generateStructured(SYSTEM_PROMPT, PROMPT, INPUT_SCHEMA),
          'Gemini returned non-JSON response',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });
  });

  describe('Given generateText', () => {
    describe('When Gemini returns a response', () => {
      test('Then it calls the model with the system instruction and returns the raw text answer', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => LLM_ANSWER },
        });

        const result = await sut.generateText(SYSTEM_PROMPT, USER_MESSAGE);

        expect(result).toBe(LLM_ANSWER);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({
          model: 'gemini-3.5-flash',
          systemInstruction: SYSTEM_PROMPT,
        });
        expect(mockGenerateContent).toHaveBeenCalledWith(USER_MESSAGE);
      });
    });

    describe('When the Gemini API call throws', () => {
      test('Then it throws 500 with "Gemini API call failed"', async () => {
        mockGenerateContent.mockRejectedValueOnce(new Error('rate limit exceeded'));

        await AssertUtils.assertError(
          () => sut.generateText(SYSTEM_PROMPT, USER_MESSAGE),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });
  });

  describe('Given generateEmbedding', () => {
    describe('When embedContent succeeds', () => {
      test('Then it calls gemini-embedding-001 with structured content and returns the values', async () => {
        mockEmbedContent.mockResolvedValueOnce({ embedding: { values: SAMPLE_EMBEDDING } });

        const result = await sut.generateEmbedding(SAMPLE_TEXT);

        expect(result).toEqual(SAMPLE_EMBEDDING);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-embedding-001' });
        expect(mockEmbedContent).toHaveBeenCalledWith({
          content: { role: 'user', parts: [{ text: SAMPLE_TEXT }] },
          outputDimensionality: 768,
        });
      });
    });

    describe('When embedContent throws', () => {
      test('Then it throws 500 with "Gemini API call failed" and records no metric', async () => {
        mockEmbedContent.mockRejectedValueOnce(new Error('network timeout'));

        await AssertUtils.assertError(
          () => sut.generateEmbedding(SAMPLE_TEXT),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
        expect(metricsReporter.record).not.toHaveBeenCalled();
      });
    });

    describe('When called with an operation tagged in AiUsageContextService', () => {
      test('Then it records the metric against the embedding model, using an estimated token count since embedContent exposes no usage metadata', async () => {
        usageContext.getOperation.mockReturnValue('EMBEDDING');
        mockEmbedContent.mockResolvedValueOnce({ embedding: { values: SAMPLE_EMBEDDING } });

        await sut.generateEmbedding(SAMPLE_TEXT);

        expect(metricsReporter.record).toHaveBeenCalledWith({
          operation: 'EMBEDDING',
          model: 'gemini-embedding-001',
          usage: { promptTokens: 13, completionTokens: 0, totalTokens: 13 },
          estimatedCostUsd: expect.any(Number),
          durationMs: expect.any(Number),
        });
      });
    });

    describe('When called with no operation tagged in AiUsageContextService', () => {
      test('Then it does not record a metric', async () => {
        mockEmbedContent.mockResolvedValueOnce({ embedding: { values: SAMPLE_EMBEDDING } });

        await sut.generateEmbedding(SAMPLE_TEXT);

        expect(metricsReporter.record).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given extractTextFromImage', () => {
    describe('When Gemini returns extracted text', () => {
      test('Then it calls the model with the OCR prompt and inline image data, and returns the raw text', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => OCR_TEXT, usageMetadata: undefined },
        });

        const result = await sut.extractTextFromImage(IMAGE_BUFFER, 'image/png');

        expect(result).toBe(OCR_TEXT);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-3.5-flash' });
        expect(mockGenerateContent).toHaveBeenCalledWith([
          { text: 'Extract all text visible in this image, verbatim. Return only the extracted text.' },
          { inlineData: { data: IMAGE_BUFFER.toString('base64'), mimeType: 'image/png' } },
        ]);
      });
    });

    describe('When called with an operation tagged in AiUsageContextService', () => {
      test('Then it records the metric with the extracted token usage', async () => {
        usageContext.getOperation.mockReturnValue('TICKET_OCR');
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => OCR_TEXT,
            usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 8, totalTokenCount: 308 },
          },
        });

        await sut.extractTextFromImage(IMAGE_BUFFER, 'image/png');

        expect(metricsReporter.record).toHaveBeenCalledWith({
          operation: 'TICKET_OCR',
          model: 'gemini-3.5-flash',
          usage: { promptTokens: 300, completionTokens: 8, totalTokens: 308 },
          estimatedCostUsd: expect.any(Number),
          durationMs: expect.any(Number),
        });
      });
    });

    describe('When the Gemini API call throws', () => {
      test('Then it throws 500 with "Gemini API call failed" and records no metric', async () => {
        mockGenerateContent.mockRejectedValueOnce(new Error('upstream error'));

        await AssertUtils.assertError(
          () => sut.extractTextFromImage(IMAGE_BUFFER, 'image/png'),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
        expect(metricsReporter.record).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given extractTextFromDocument', () => {
    describe('When Gemini returns extracted text', () => {
      test('Then it calls the model with the document extraction prompt and inline document data, and returns the raw text', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => DOCUMENT_TEXT, usageMetadata: undefined },
        });

        const result = await sut.extractTextFromDocument(PDF_BUFFER, 'application/pdf');

        expect(result).toBe(DOCUMENT_TEXT);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-3.5-flash' });
        expect(mockGenerateContent).toHaveBeenCalledWith([
          {
            text:
              'Extract all text content from this document, verbatim, preserving section headings and ' +
              'paragraph structure where helpful for readability. Return only the extracted text, no commentary.',
          },
          { inlineData: { data: PDF_BUFFER.toString('base64'), mimeType: 'application/pdf' } },
        ]);
      });
    });

    describe('When the Gemini API call throws', () => {
      test('Then it throws 500 with "Gemini API call failed" and records no metric', async () => {
        mockGenerateContent.mockRejectedValueOnce(new Error('upstream error'));

        await AssertUtils.assertError(
          () => sut.extractTextFromDocument(PDF_BUFFER, 'application/pdf'),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
        expect(metricsReporter.record).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given transcribeAudio', () => {
    describe('When Gemini returns a transcript', () => {
      test('Then it calls the model with the transcription prompt and inline audio data, and returns the raw text', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => TRANSCRIPT_TEXT, usageMetadata: undefined },
        });

        const result = await sut.transcribeAudio(AUDIO_BUFFER, 'audio/aiff');

        expect(result).toBe(TRANSCRIPT_TEXT);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-3.5-flash' });
        expect(mockGenerateContent).toHaveBeenCalledWith([
          { text: 'Transcribe this audio recording verbatim. Return only the transcribed text.' },
          { inlineData: { data: AUDIO_BUFFER.toString('base64'), mimeType: 'audio/aiff' } },
        ]);
      });
    });

    describe('When called with an operation tagged in AiUsageContextService', () => {
      test('Then it records the metric with the extracted token usage', async () => {
        usageContext.getOperation.mockReturnValue('TICKET_STT');
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => TRANSCRIPT_TEXT,
            usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 15, totalTokenCount: 515 },
          },
        });

        await sut.transcribeAudio(AUDIO_BUFFER, 'audio/aiff');

        expect(metricsReporter.record).toHaveBeenCalledWith({
          operation: 'TICKET_STT',
          model: 'gemini-3.5-flash',
          usage: { promptTokens: 500, completionTokens: 15, totalTokens: 515 },
          estimatedCostUsd: expect.any(Number),
          durationMs: expect.any(Number),
        });
      });
    });

    describe('When the Gemini API call throws', () => {
      test('Then it throws 500 with "Gemini API call failed" and records no metric', async () => {
        mockGenerateContent.mockRejectedValueOnce(new Error('upstream error'));

        await AssertUtils.assertError(
          () => sut.transcribeAudio(AUDIO_BUFFER, 'audio/aiff'),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
        expect(metricsReporter.record).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given generateWithTools', () => {
    describe('When the model returns a function call', () => {
      test('Then it calls the model with the system instruction and tools, and returns tool_call with the tool name and args', async () => {
        mockSendMessage.mockResolvedValueOnce({
          response: {
            functionCalls: () => [{ name: 'searchKb', args: { query: 'checkout crash' } }],
            text: () => '',
          },
        });

        const result = await sut.generateWithTools(AGENT_SYSTEM_PROMPT, AGENT_HISTORY, AGENT_TOOLS);

        expect(result).toEqual({ type: 'tool_call', toolName: 'searchKb', args: { query: 'checkout crash' } });
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({
          model: 'gemini-3.5-flash',
          systemInstruction: AGENT_SYSTEM_PROMPT,
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'searchKb',
                  description: 'Search the KB semantically.',
                  parameters: {
                    type: SchemaType.OBJECT,
                    properties: { query: { type: SchemaType.STRING } },
                    required: ['query'],
                  },
                },
              ],
            },
          ],
        });
        expect(mockStartChat).toHaveBeenCalledWith({ history: [] }); // history slice(0,-1) is empty for single user message
        expect(mockSendMessage).toHaveBeenCalledWith([{ text: 'What do we know about this ticket?' }]);
      });
    });

    describe('When the model returns a text answer', () => {
      test('Then it returns final_answer with the text', async () => {
        mockSendMessage.mockResolvedValueOnce({
          response: {
            functionCalls: () => [],
            text: () => LLM_ANSWER,
          },
        });

        const result = await sut.generateWithTools(AGENT_SYSTEM_PROMPT, AGENT_HISTORY, AGENT_TOOLS);

        expect(result).toEqual({ type: 'final_answer', text: LLM_ANSWER });
      });
    });

    describe('When history includes a prior tool_result', () => {
      test('Then prior turns go to startChat history and tool_result goes to sendMessage as functionResponse', async () => {
        mockSendMessage.mockResolvedValueOnce({
          response: { functionCalls: () => [], text: () => LLM_ANSWER },
        });

        const historyWithToolResult: AgentMessage[] = [
          { role: 'user', text: 'What do we know about this ticket?' },
          { role: 'tool_call', toolName: 'searchKb', args: { query: 'checkout crash' } },
          { role: 'tool_result', toolName: 'searchKb', result: { found: 1 } },
        ];

        await sut.generateWithTools(AGENT_SYSTEM_PROMPT, historyWithToolResult, AGENT_TOOLS);

        expect(mockStartChat).toHaveBeenCalledWith({
          history: [
            { role: 'user', parts: [{ text: 'What do we know about this ticket?' }] },
            { role: 'model', parts: [{ functionCall: { name: 'searchKb', args: { query: 'checkout crash' } } }] },
          ],
        });
        expect(mockSendMessage).toHaveBeenCalledWith([
          { functionResponse: { name: 'searchKb', response: { result: { found: 1 } } } },
        ]);
      });
    });

    describe('When the last history message has an unexpected role', () => {
      test('Then it throws 500 before calling the API', async () => {
        const badHistory: AgentMessage[] = [
          { role: 'user', text: 'question' },
          { role: 'tool_call', toolName: 'searchKb', args: { query: 'checkout crash' } },
        ];

        await AssertUtils.assertError(
          () => sut.generateWithTools(AGENT_SYSTEM_PROMPT, badHistory, AGENT_TOOLS),
          'generateWithTools called with unexpected last message role: tool_call',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
        expect(mockSendMessage).not.toHaveBeenCalled();
      });
    });

    describe('When the Gemini API throws', () => {
      test('Then it throws 500 with "Gemini API call failed"', async () => {
        mockSendMessage.mockRejectedValueOnce(new Error('upstream error'));

        await AssertUtils.assertError(
          () => sut.generateWithTools(AGENT_SYSTEM_PROMPT, AGENT_HISTORY, AGENT_TOOLS),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });
  });

  describe('Given generateTextStream', () => {
    describe('When Gemini streams chunks', () => {
      test('Then it yields each chunk of text as it arrives and calls the model with the system instruction', async () => {
        mockGenerateContentStream.mockResolvedValueOnce({
          stream: asyncIterableOf([{ text: () => 'A missing ' }, { text: () => 'onClick handler.' }]),
          response: Promise.resolve({
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
          }),
        });

        const chunks: string[] = [];
        for await (const chunk of sut.generateTextStream(SYSTEM_PROMPT, USER_MESSAGE)) {
          chunks.push(chunk);
        }

        expect(chunks).toEqual(['A missing ', 'onClick handler.']);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({
          model: 'gemini-3.5-flash',
          systemInstruction: SYSTEM_PROMPT,
        });
        expect(mockGenerateContentStream).toHaveBeenCalledWith(USER_MESSAGE);
      });

      test('Then it records the metric under whatever operation is tagged in AiUsageContextService at the time each chunk resolves', async () => {
        usageContext.getOperation.mockReturnValue('TICKET_OCR');
        mockGenerateContentStream.mockResolvedValueOnce({
          stream: asyncIterableOf([{ text: () => LLM_ANSWER }]),
          response: Promise.resolve({
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
          }),
        });

        for await (const _chunk of sut.generateTextStream(SYSTEM_PROMPT, USER_MESSAGE)) {
          // drain the stream so the post-stream usage recording runs
        }

        expect(metricsReporter.record).toHaveBeenCalledWith({
          operation: 'TICKET_OCR',
          model: 'gemini-3.5-flash',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          estimatedCostUsd: expect.any(Number),
          durationMs: expect.any(Number),
        });
      });
    });

    describe('When the Gemini API throws', () => {
      test('Then it throws 500 with "Gemini API call failed" and records no metric', async () => {
        mockGenerateContentStream.mockRejectedValueOnce(new Error('upstream error'));

        const consume = async () => {
          for await (const _chunk of sut.generateTextStream(SYSTEM_PROMPT, USER_MESSAGE)) {
            // no-op
          }
        };

        await AssertUtils.assertError(consume, 'Gemini API call failed', HttpStatus.INTERNAL_SERVER_ERROR);
        expect(metricsReporter.record).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given usage tracking', () => {
    describe('When a generation method is called with an operation tagged in AiUsageContextService', () => {
      test('Then it records the metric under that operation with the extracted token usage', async () => {
        usageContext.getOperation.mockReturnValue('TICKET_STT');
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => LLM_ANSWER,
            usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20, totalTokenCount: 70 },
          },
        });

        await sut.generateText(SYSTEM_PROMPT, USER_MESSAGE);

        expect(metricsReporter.record).toHaveBeenCalledWith({
          operation: 'TICKET_STT',
          model: 'gemini-3.5-flash',
          usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
          estimatedCostUsd: expect.any(Number),
          durationMs: expect.any(Number),
        });
      });
    });

    describe('When a generation method is called with no operation tagged in AiUsageContextService', () => {
      test('Then it does not record a metric', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => LLM_ANSWER, usageMetadata: undefined },
        });

        await sut.generateText(SYSTEM_PROMPT, USER_MESSAGE);

        expect(metricsReporter.record).not.toHaveBeenCalled();
      });
    });
  });
});
