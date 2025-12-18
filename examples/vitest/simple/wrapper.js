import { test as _test } from "vitest";
import { context, trace } from "@opentelemetry/api";
import * as otr from "@otel-test-runner/instrumentation";
import * as opentelemetry from "@opentelemetry/api";

otr.initialize()

export const tracer = otr.getTracer("test-tracer/bun");

/**
 * Preserve Vitest's extended API (only/skip/each/concurrent/etc.)
 */
function decorate(original) {
  const wrapped = wrapVitestFn(original);
  if (original?.only) wrapped.only = wrapVitestFn(original.only);
  if (original?.skip) wrapped.skip = wrapVitestFn(original.skip);
  if (original?.concurrent)
    wrapped.concurrent = wrapVitestFn(original.concurrent);
  if (original?.sequential)
    wrapped.sequential = wrapVitestFn(original.sequential);
  if (original?.fails) wrapped.fails = wrapVitestFn(original.fails);
  if (original?.todo) wrapped.todo = original.todo.bind(original);
  if (original?.each) {
    wrapped.each = (...templ) => {
      const eachBase = original.each(...templ);
      return wrapVitestFn(eachBase);
    };
  }
  return wrapped;
}

async function runTestInsideSpan(name, fn) {
  const currentCtx = context.active();

  if (trace.getSpan(currentCtx) === undefined) {
    console.log("inject");

    return await context.with(otr.injectTraceParentInContext(), async () => {
      return tracer.startActiveSpan(name, async () => fn());
    });
  }

  return tracer.startActiveSpan(name, async () => fn());
}

/**
 * Wrap a Vitest test function so the body runs inside the seeded context
 * when there's no active span yet.
 */
function wrapVitestFn(original) {
  if (typeof original !== "function") return original;

  return function (name, fn, options) {
    const wrapped =
      typeof fn === "function"
        ? async function (...args) {
            const ctx = otr.injectTraceParentInContext()
            console.log(ctx)
          
            return await context.with(
              otr.injectTraceParentInContext(),
              async () => {
                console.log(context.active());

                return await runTestInsideSpan(
                  name,
                  async () => await fn.apply(this, args),
                );
              },
            );
          }
        : fn; // keep pending/skip/todo unchanged
    return original(name, wrapped, options);
  };
}

export const test = wrapVitestFn(_test);
