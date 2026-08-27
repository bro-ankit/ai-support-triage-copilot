import * as dotenv from 'dotenv';

dotenv.config();

import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

import { ENV_VARIABLES } from '../constants/env.constants';
import { TRACER_NAME, TRACING_DEFAULTS } from './tracing.constants';

export function bootstrapTracing(): void {
  const endpoint = process.env[ENV_VARIABLES.TRACING.OTLP_ENDPOINT] ?? TRACING_DEFAULTS.OTLP_ENDPOINT;

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: TRACER_NAME }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: endpoint }))],
  });

  provider.register({ contextManager: new AsyncLocalStorageContextManager() });

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [new HttpInstrumentation(), new PgInstrumentation(), new NestInstrumentation()],
  });
}
