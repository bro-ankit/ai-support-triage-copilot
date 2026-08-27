import { SetMetadata } from '@nestjs/common';
import type { Attributes } from '@opentelemetry/api';

export const TRACED_KEY = Symbol('TRACED_KEY');

export type TracedMetadata<TArgs extends unknown[] = unknown[], TResult = unknown> = {
  spanName?: string;
  mapArgs?: (...args: TArgs) => Attributes;
  mapResult?: (result: TResult) => Attributes;
};

export const Traced =
  <TArgs extends unknown[] = unknown[], TResult = unknown>(
    spanName?: string,
    mapArgs?: (...args: TArgs) => Attributes,
    mapResult?: (result: TResult) => Attributes,
  ): MethodDecorator =>
    (target, propertyKey, descriptor: PropertyDescriptor) => {
      SetMetadata<symbol, TracedMetadata<TArgs, TResult>>(TRACED_KEY, { spanName, mapArgs, mapResult })(
        target,
        propertyKey,
        descriptor,
      );
      return descriptor;
    };
