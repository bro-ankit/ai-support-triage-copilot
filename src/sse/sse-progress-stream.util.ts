import type { MessageEvent, Type } from '@nestjs/common';
import { EventBus, IEvent, ofType } from '@nestjs/cqrs';
import { defer, fromEvent, merge, Observable, of, Subject } from 'rxjs';
import { catchError, filter, finalize, map, takeUntil, timeout } from 'rxjs/operators';

export type SseProgressStreamOptions<TProgressEvent extends IEvent, TResult> = {
  eventBus: EventBus;
  eventType: Type<TProgressEvent>;
  matches: (event: TProgressEvent) => boolean;
  mapProgress: (event: TProgressEvent) => MessageEvent;
  execute: () => Promise<TResult>;
  mapResult: (result: TResult) => MessageEvent;
  abortSignal: AbortSignal;
  timeoutMs?: number;
};


export class SseProgressStreamUtil {
  private static readonly TIMEOUT_MS = 60_000;

  static build<TProgressEvent extends IEvent, TResult>(
    options: SseProgressStreamOptions<TProgressEvent, TResult>,
  ): Observable<MessageEvent> {
    const progress$ = new Subject<MessageEvent>();
    const progressSubscription = options.eventBus
      .pipe(ofType(options.eventType), filter(options.matches))
      .subscribe((event) => progress$.next(options.mapProgress(event)));

    const result$ = defer(() => options.execute()).pipe(
      map(options.mapResult),
      catchError((err: unknown) =>
        of<MessageEvent>({
          type: 'error',
          data: { message: err instanceof Error ? err.message : 'Request failed' },
        }),
      ),
      finalize(() => progress$.complete()),
    );

    const abort$ = fromEvent(options.abortSignal, 'abort');

    return merge(progress$, result$).pipe(
      finalize(() => progressSubscription.unsubscribe()),
      takeUntil(abort$),
      timeout(options.timeoutMs ?? this.TIMEOUT_MS),
      catchError(() =>
        of<MessageEvent>({
          type: 'error',
          data: { message: 'Request timed out or was terminated.' },
        }),
      ),
    );
  }
}
