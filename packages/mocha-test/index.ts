import type { Context, Span } from "@opentelemetry/api";
import * as optl from "@opentelemetry/api";

import * as otr from "@otel-test-runner/instrumentation";

otr.initialize();

global.after(async () => {
  try {
    await otr.close();
  } catch {
    console.warn("[WARN] couldn't close otel client");
  }
});

export const tracer = otr.getTracer("test-tracer/mocha");

/**
 * Utility function to automatically inject `TRACEPARENT` if the span
 * is the root span. This is useful in the context of Dagger so traces
 * produced by the tests are displayed by the TUI and Dagger Cloud.
 *
 * If we are already in a span, then the newly created span must be children
 * if the parent.
 */
export async function runTestInsideSpan<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
  const currentCtx = optl.context.active();

  if (optl.trace.getSpan(currentCtx) === undefined) {
    return await optl.context.with(otr.injectTraceParentInContext(), async () => {
      return tracer.startActiveSpan(name, async () => fn());
    });
  }

  return tracer.startActiveSpan(name, async () => fn());
}

export type TestTree = {
  name: string;
  parent?: TestTree;
  ctx?: Context;
  span?: Span;
};

export const testTree: TestTree[] = [];

function wrapTestFunction(originalFunction: any): any {
  return (name: string, fn: () => any | Promise<any>) => {
    const node = testTree[testTree.length - 1];
    return originalFunction(name, async () => {
      const parentCtx = node?.ctx ?? otr.injectTraceParentInContext();
      await optl.context.with(parentCtx, async () => {
        await runTestInsideSpan(name, fn);
      });
    });
  };
}

const baseTest = wrapTestFunction(global.it);

baseTest.skip = wrapTestFunction(global.it.skip);
baseTest.only = wrapTestFunction(global.it.only);

/**
 * @see https://mochajs.org/next/interfaces/bdd/
 */
export const it: typeof global.it = baseTest;

/**
 * @see https://mochajs.org/next/interfaces/bdd/
 */
export const specify: typeof global.specify = baseTest;

function wrapDescribeFunction(originalDescribe: typeof global.describe): any {
  return (name: string, fn: () => void) => {
    const parent = testTree[testTree.length - 1];
    const node: TestTree = { name, parent };

    // Synchronous: only register hooks and tests here
    return originalDescribe(name, () => {
      // Create a node linked to its parent for proper nesting
      testTree.push(node);

      // Start the group span before any tests in this describe run
      global.before(() => {
        let base = parent?.ctx ?? optl.context.active();
        if (!optl.trace.getSpan(base)) {
          // Seed from TRACEPARENT if provided
          base = otr.injectTraceParentInContext();
        }

        const span = tracer.startSpan(name, undefined, base);
        node.ctx = optl.trace.setSpan(base, span);
        node.span = span;
      });

      // End the group span after all tests in this describe finish
      global.after(() => {
        node.span?.end();
      });

      // Register inner tests/inner describes
      fn();

      // Pop immediately (registration is done); runtime uses before/after
      testTree.pop();
    });
  };
}

const baseDescribe = wrapDescribeFunction(global.describe);

/**
 * @see https://mochajs.org/next/interfaces/bdd/
 */
export const describe: typeof global.describe = baseDescribe;

/**
 * @see https://mochajs.org/next/interfaces/bdd/
 */
export const context: typeof global.context = baseDescribe;
