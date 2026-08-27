import { trace } from "@opentelemetry/api";

export function traceLogMixin(): Record<string, string> {
    const span = trace.getActiveSpan();
    if (!span) return {};

    const { traceId, spanId } = span.spanContext();
    return { traceId, spanId };
}