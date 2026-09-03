import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { SpanStatusCode } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { Traced } from '../../src/tracing/traced.decorator';
import { TracingDiscoveryService } from '../../src/tracing/tracing-discovery.service';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
class DummyClassifierService {
  @Traced('custom_span_name')
  async run(): Promise<string> {
    await wait(1);
    return 'ok';
  }

  async untaggedRun(): Promise<string> {
    return 'ok';
  }

  @Traced()
  async failingRun(): Promise<string> {
    await wait(1);
    throw new Error('boom');
  }

  async callPrivateRun(): Promise<string> {
    return this.privateRun();
  }

  @Traced('private_span')
  private async privateRun(): Promise<string> {
    await wait(1);
    return 'ok';
  }

  @Traced<[string], { category: string }>(
    'run_with_attributes',
    (ticketId) => ({ 'ticket.id': ticketId }),
    (result) => ({ 'classification.category': result.category }),
  )
  async runWithAttributes(_ticketId: string): Promise<{ category: string }> {
    await wait(1);
    return { category: 'billing' };
  }

  @Traced('child_span')
  async childRun(): Promise<string> {
    await wait(1);
    return 'child-done';
  }

  @Traced<[string], string>(
    'stream_span',
    (ticketId) => ({ 'ticket.id': ticketId }),
    (lastValue) => ({ 'last.value': lastValue }),
  )
  async *streamRun(_ticketId: string): AsyncGenerator<string> {
    yield 'first';
    await this.childRun();
    yield 'second';
  }

  @Traced('failing_stream_span')
  async *failingStreamRun(): AsyncGenerator<string> {
    yield 'before-failure';
    throw new Error('stream boom');
  }
}

describe('TracingDiscoveryService IT', () => {
  let module: TestingModule;
  let dummy: DummyClassifierService;
  let memoryExporter: InMemorySpanExporter;

  beforeAll(async () => {
    memoryExporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(memoryExporter)] });
    provider.register();

    module = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [TracingDiscoveryService, DummyClassifierService],
    }).compile();

    dummy = module.get(DummyClassifierService);
    await module.init();
  });

  afterAll(() => module.close());

  beforeEach(() => {
    memoryExporter.reset();
  });

  describe('Given a method decorated with @Traced and an explicit span name', () => {
    describe('When it is called and succeeds', () => {
      test('Then a span with that name is recorded with an OK status', async () => {
        await dummy.run();

        const spans = memoryExporter.getFinishedSpans();
        expect(spans).toHaveLength(1);
        expect(spans[0].name).toBe('custom_span_name');
        expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
      });
    });
  });

  describe('Given a method decorated with @Traced and no explicit span name', () => {
    describe('When it is called', () => {
      test('Then the span name defaults to ClassName.methodName', async () => {
        await dummy.failingRun().catch(() => undefined);

        const spans = memoryExporter.getFinishedSpans();
        expect(spans[0].name).toBe('DummyClassifierService.failingRun');
      });
    });
  });

  describe('Given a method decorated with @Traced', () => {
    describe('When it throws', () => {
      test('Then the span records the exception and an ERROR status, and the error still propagates', async () => {
        await expect(dummy.failingRun()).rejects.toThrow('boom');

        const spans = memoryExporter.getFinishedSpans();
        expect(spans).toHaveLength(1);
        expect(spans[0].status).toEqual({ code: SpanStatusCode.ERROR, message: 'boom' });
        expect(spans[0].events).toHaveLength(1);
        expect(spans[0].events[0].name).toBe('exception');
      });
    });
  });

  describe('Given a private method decorated with @Traced', () => {
    describe('When it is called via a public wrapper method', () => {
      test('Then the span is still recorded, TypeScript private is erased at runtime', async () => {
        await dummy.callPrivateRun();

        const spans = memoryExporter.getFinishedSpans();
        expect(spans).toHaveLength(1);
        expect(spans[0].name).toBe('private_span');
      });
    });
  });

  describe('Given a method without the decorator', () => {
    describe('When it is called', () => {
      test('Then no span is recorded', async () => {
        await dummy.untaggedRun();

        expect(memoryExporter.getFinishedSpans()).toHaveLength(0);
      });
    });
  });

  describe('Given a method decorated with @Traced, mapArgs, and mapResult', () => {
    describe('When it is called and succeeds', () => {
      test('Then the span carries attributes derived from both the arguments and the return value', async () => {
        await dummy.runWithAttributes('ticket-123');

        const spans = memoryExporter.getFinishedSpans();
        expect(spans).toHaveLength(1);
        expect(spans[0].attributes).toEqual({ 'ticket.id': 'ticket-123', 'classification.category': 'billing' });
      });
    });
  });

  describe('Given an async generator method decorated with @Traced', () => {
    describe('When it is drained to completion', () => {
      test('Then a single span stays open for the whole generator, carries mapArgs/mapResult attributes from the last yielded value, and nests a @Traced call made mid-stream as its child', async () => {
        const values: string[] = [];
        for await (const value of dummy.streamRun('ticket-456')) {
          values.push(value);
        }

        expect(values).toEqual(['first', 'second']);

        const spans = memoryExporter.getFinishedSpans();
        expect(spans).toHaveLength(2);

        const childSpan = spans.find((s) => s.name === 'child_span');
        const streamSpan = spans.find((s) => s.name === 'stream_span');
        expect(childSpan).toBeDefined();
        expect(streamSpan).toBeDefined();
        expect(streamSpan?.status.code).toBe(SpanStatusCode.UNSET);
        expect(streamSpan?.attributes).toEqual({ 'ticket.id': 'ticket-456', 'last.value': 'second' });
        expect(childSpan?.parentSpanContext?.spanId).toBe(streamSpan?.spanContext().spanId);
      });
    });

    describe('When it throws partway through', () => {
      test('Then the values yielded before the failure are still produced, and the span records the exception and an ERROR status', async () => {
        const values: string[] = [];
        const iterate = async () => {
          for await (const value of dummy.failingStreamRun()) {
            values.push(value);
          }
        };

        await expect(iterate()).rejects.toThrow('stream boom');
        expect(values).toEqual(['before-failure']);

        const spans = memoryExporter.getFinishedSpans();
        expect(spans).toHaveLength(1);
        expect(spans[0].name).toBe('failing_stream_span');
        expect(spans[0].status).toEqual({ code: SpanStatusCode.ERROR, message: 'stream boom' });
        expect(spans[0].events).toHaveLength(1);
        expect(spans[0].events[0].name).toBe('exception');
      });
    });
  });
});
