import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { SpanStatusCode, trace } from '@opentelemetry/api';

import { TRACED_KEY, type TracedMetadata } from './traced.decorator';
import { TRACER_NAME } from './tracing.constants';

@Injectable()
export class TracingDiscoveryService implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    const tracer = trace.getTracer(TRACER_NAME);

    for (const wrapper of this.discovery.getProviders()) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') continue;

      const proto = Object.getPrototypeOf(instance);
      const className = proto.constructor.name as string;

      this.scanner.getAllMethodNames(proto).forEach((methodName) => {
        const meta = this.reflector.get<TracedMetadata>(TRACED_KEY, proto[methodName]);
        if (!meta) return;

        const spanName = meta.spanName ?? `${className}.${methodName}`;
        const original = proto[methodName] as (...args: unknown[]) => unknown;

        proto[methodName] = function (...args: unknown[]) {
          return tracer.startActiveSpan(spanName, async (span) => {
            try {
              if (meta.mapArgs) span.setAttributes(meta.mapArgs(...args));
              const result = await original.apply(this, args);
              if (meta.mapResult) span.setAttributes(meta.mapResult(result));
              return result;
            } catch (err) {
              span.recordException(err as Error);
              span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
              throw err;
            } finally {
              span.end();
            }
          });
        };

        for (const key of Reflect.getMetadataKeys(original) as unknown[]) {
          Reflect.defineMetadata(key, Reflect.getMetadata(key, original), proto[methodName]);
        }
      });
    }
  }
}
