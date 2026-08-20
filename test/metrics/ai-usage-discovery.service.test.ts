import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { AiUsageContextService } from '../../src/metrics/ai-usage-context.service';
import { AiUsageDiscoveryService } from '../../src/metrics/ai-usage-discovery.service';
import { TrackAiUsage } from '../../src/metrics/track-ai-usage.decorator';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
class DummyTicketOcrService {
  constructor(private readonly context: AiUsageContextService) {}

  @TrackAiUsage('TICKET_OCR')
  async run(): Promise<string | undefined> {
    await wait(1); // operation must survive this await, same as GeminiClient awaiting Gemini
    return this.context.getOperation();
  }

  async untaggedRun(): Promise<string | undefined> {
    return this.context.getOperation();
  }

  async callPrivateRun(): Promise<string | undefined> {
    return this.privateRun();
  }

  @TrackAiUsage('TICKET_STT')
  private async privateRun(): Promise<string | undefined> {
    await wait(1);
    return this.context.getOperation();
  }
}

describe('AiUsageDiscoveryService IT', () => {
  let module: TestingModule;
  let dummy: DummyTicketOcrService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [AiUsageContextService, AiUsageDiscoveryService, DummyTicketOcrService],
    }).compile();

    dummy = module.get(DummyTicketOcrService);
    await module.init();
  });

  afterAll(() => module.close());

  describe('Given a method decorated with @TrackAiUsage', () => {
    describe('When it is called', () => {
      test('Then the operation is available via AiUsageContextService for the duration of the call', async () => {
        const seen = await dummy.run();
        expect(seen).toBe('TICKET_OCR');
      });
    });
  });

  describe('Given a private method decorated with @TrackAiUsage', () => {
    describe('When it is called via a public wrapper method', () => {
      test('Then the operation is still tracked, TypeScript private is erased at runtime', async () => {
        const seen = await dummy.callPrivateRun();
        expect(seen).toBe('TICKET_STT');
      });
    });
  });

  describe('Given a method without the decorator', () => {
    describe('When it is called', () => {
      test('Then no operation is tagged and the context stays empty', async () => {
        const seen = await dummy.untaggedRun();
        expect(seen).toBeUndefined();
      });
    });
  });

  describe('Given the decorated method has already returned', () => {
    describe('When an unrelated undecorated method is called afterwards', () => {
      test('Then the context does not leak into that later call', async () => {
        await dummy.run();
        const seen = await dummy.untaggedRun();
        expect(seen).toBeUndefined();
      });
    });
  });
});
