import * as opentelemetry from "@opentelemetry/api";

/**
 * Inject the `TRACEPARENT` in the current OTEL context
 * so [`Dagger`](https://dagger.io) can be traced.
 */
export function injectTraceParentInContext(): opentelemetry.Context {
  const ctx = opentelemetry.context.active();

  const spanCtx = opentelemetry.trace.getSpanContext(ctx);
  if (spanCtx && opentelemetry.trace.isSpanContextValid(spanCtx)) {
    return ctx;
  }

  const parentID = process.env.TRACEPARENT;
  if (parentID) {
    return opentelemetry.propagation.extract(ctx, {
      traceparent: parentID,
    });
  }

  return ctx;
}
