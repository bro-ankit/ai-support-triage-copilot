import type { EventBus } from '@nestjs/cqrs';
import { firstValueFrom, Subject, toArray } from 'rxjs';

import { SseProgressStreamOptions, SseProgressStreamUtil } from '../../src/sse/sse-progress-stream.util';

class DummyProgressEvent {
  constructor(
    public readonly id: string,
    public readonly value: string,
  ) { }
}

describe('SseProgressStreamUtil Unit Test', () => {
  let eventBusSubject: Subject<DummyProgressEvent>;

  beforeEach(() => {
    eventBusSubject = new Subject<DummyProgressEvent>();
  });

  const buildOptions = (
    overrides: Partial<SseProgressStreamOptions<DummyProgressEvent, object>> = {},
  ): SseProgressStreamOptions<DummyProgressEvent, object> => ({
    eventBus: eventBusSubject as unknown as EventBus,
    eventType: DummyProgressEvent,
    matches: (event) => event.id === 'a',
    mapProgress: (event) => ({ type: 'progress', data: { value: event.value } }),
    execute: jest.fn(),
    mapResult: (result) => ({ type: 'result', data: result }),
    abortSignal: new AbortController().signal,
    ...overrides,
  });

  describe('Given build', () => {
    describe('When execute publishes matching and non-matching progress events before resolving', () => {
      test('Then it emits only the matching progress events followed by a result event', async () => {
        const execute = jest.fn().mockImplementation(async () => {
          eventBusSubject.next(new DummyProgressEvent('a', 'included'));
          eventBusSubject.next(new DummyProgressEvent('b', 'excluded'));
          return { total: 42 };
        });

        const events = await firstValueFrom(SseProgressStreamUtil.build(buildOptions({ execute })).pipe(toArray()));

        expect(events).toEqual([
          { type: 'progress', data: { value: 'included' } },
          { type: 'result', data: { total: 42 } },
        ]);
      });
    });

    describe('When execute rejects with an Error', () => {
      test('Then it emits a single error event with the rejection message', async () => {
        const execute = jest.fn().mockRejectedValue(new Error('boom'));

        const events = await firstValueFrom(SseProgressStreamUtil.build(buildOptions({ execute })).pipe(toArray()));

        expect(events).toEqual([{ type: 'error', data: { message: 'boom' } }]);
      });
    });

    describe('When execute rejects with a non-Error value', () => {
      test('Then it emits a single error event with a generic message', async () => {
        const execute = jest.fn().mockRejectedValue('not an error instance');

        const events = await firstValueFrom(SseProgressStreamUtil.build(buildOptions({ execute })).pipe(toArray()));

        expect(events).toEqual([{ type: 'error', data: { message: 'Request failed' } }]);
      });
    });

    describe('When execute does not resolve before timeoutMs', () => {
      test('Then it emits a single timeout error event', async () => {
        const execute = jest.fn().mockImplementation(() => new Promise(() => { }));

        const events = await firstValueFrom(
          SseProgressStreamUtil.build(buildOptions({ execute, timeoutMs: 20 })).pipe(toArray()),
        );

        expect(events).toEqual([{ type: 'error', data: { message: 'Request timed out or was terminated.' } }]);
      });
    });

    describe('When the abort signal fires before execute resolves', () => {
      test('Then it completes without emitting a result', async () => {
        const abortController = new AbortController();
        const execute = jest.fn().mockImplementation(() => new Promise(() => { }));

        const eventsPromise = firstValueFrom(
          SseProgressStreamUtil.build(buildOptions({ execute, abortSignal: abortController.signal })).pipe(toArray()),
        );
        abortController.abort();

        expect(await eventsPromise).toEqual([]);
      });
    });

    describe('When the stream completes', () => {
      test('Then it unsubscribes from the event bus', async () => {
        const execute = jest.fn().mockResolvedValue({ total: 1 });

        await firstValueFrom(SseProgressStreamUtil.build(buildOptions({ execute })).pipe(toArray()));

        expect(eventBusSubject.observed).toBe(false);
      });
    });
  });
});
