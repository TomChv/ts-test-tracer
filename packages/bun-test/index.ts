import * as bunTest from "bun:test";
import { context, trace, type Context, type Span } from "@opentelemetry/api";
import * as otr from "@otel-test-runner/instrumentation";

/**
 * On import, we automatically initialize telemetry so spans
 * can be created when creating tests groups.
 */
otr.initialize();

/**
 * Shutdown telemetry after tests are completed.
 * This hook is automatically register on Bun tests runners
 * when imported
 */
bunTest.afterAll(async () => {
  await otr.close();
});

const tracer = otr.getTracer("test-tracer/bun");

/**
 * Utility function to automatically inject `TRACEPARENT` if the span
 * is the root span. This is useful in the context of Dagger so traces
 * produced by the tests are displayed by the TUI and Dagger Cloud.
 *
 * If we are already in a span, then the newly created span must be children
 * if the parent.
 */
async function runTestInsideSpan<T>(
  name: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const currentCtx = context.active();

  if (trace.getSpan(currentCtx) === undefined) {
    return await context.with(otr.injectTraceParentInContext(), async () => {
      return tracer.startActiveSpan(name, async () => fn());
    });
  }

  return tracer.startActiveSpan(name, async () => fn());
}

/******************
 * Utility function to wrap the bun test library inside traceable function.
 * The TestTree is required because `describe` isn't wrapping `test` execution
 * so cannot track the context of the test without an external structure.
 *******************/

type TestTree = {
  name: string;
  parent?: TestTree;
  ctx?: Context;
  span?: Span;
};

const testTree: TestTree[] = [];

function wrapTestFunction(originalFunction: typeof bunTest.test): any {
  return (name: string, fn: () => any | Promise<any>, options?: any) => {
    const node = testTree[testTree.length - 1];
    return originalFunction(
      name,
      async () => {
        const parentCtx = node?.ctx ?? otr.injectTraceParentInContext();
        await context.with(parentCtx, async () => {
          await runTestInsideSpan(name, fn);
        });
      },
      options,
    );
  };
}

/******************
 * Mirror of `bun-test.test` with traces so tests can be traces by simply
 * changing the import but any existing utility methods are kept.
 *******************/

const baseTest = wrapTestFunction(bunTest.test);

baseTest.serial = wrapTestFunction(bunTest.test.serial);
baseTest.only = wrapTestFunction(bunTest.test.only);
baseTest.skip = wrapTestFunction(bunTest.test.skip);
baseTest.concurrent = wrapTestFunction(bunTest.test.concurrent);
baseTest.failing = wrapTestFunction(bunTest.test.failing);

// todo doesn't execute the body; delegate directly
baseTest.todo = bunTest.test.todo;

// if returns a test tree based on condition; wrap the returned test method.
baseTest.if = (condition: boolean) => {
  const registrar =
    bunTest.test.if?.(condition) ??
    ((condition ? bunTest.test : bunTest.test.skip) as any);
  return wrapTestFunction(registrar);
};

baseTest.concurrentIf = (condition: boolean) => {
  const registrar =
    bunTest.test.concurrentIf?.(condition) ??
    ((condition ? bunTest.test : bunTest.test.skip) as any);
  return wrapTestFunction(registrar);
};

baseTest.skipIf = (condition: boolean) => {
  const registrar =
    bunTest.test.skipIf?.(condition) ??
    ((condition ? bunTest.test : bunTest.test.skip) as any);
  return wrapTestFunction(registrar);
};

baseTest.failingIf = (condition: boolean) => {
  const registrar =
    bunTest.test.failingIf?.(condition) ??
    ((condition ? bunTest.test : bunTest.test.skip) as any);
  return wrapTestFunction(registrar);
};

baseTest.serialIf = (condition: boolean) => {
  const registrar =
    bunTest.test.serialIf?.(condition) ??
    ((condition ? bunTest.test : bunTest.test.skip) as any);
  return wrapTestFunction(registrar);
};

// TODO: buntest.Test.each

/**
 * @see https://bun.com/docs/test/writing-tests
 */
export const test: typeof bunTest.test = baseTest;

/******************
 * Mirror of `bun-test.describe` with traces so groups can be traces by simply
 * changing the import but any existing utility methods are kept.
 *******************/

/**
 * @see https://bun.com/docs/test/writing-tests
 */
export function describe(name: string, fn: () => void) {
  const parent = testTree[testTree.length - 1];
  const node: TestTree = { name, parent };

  // Synchronous: only register hooks and tests here
  return bunTest.describe(name, () => {
    // Create a node linked to its parent for proper nesting
    testTree.push(node);

    // Start the group span before any tests in this describe run
    bunTest.beforeAll(() => {
      let base = parent?.ctx ?? context.active();
      if (!trace.getSpan(base)) {
        // Seed from TRACEPARENT if provided
        base = otr.injectTraceParentInContext();
      }

      const span = tracer.startSpan(name, undefined, base);
      node.ctx = trace.setSpan(base, span);
      node.span = span;
    });

    // End the group span after all tests in this describe finish
    bunTest.afterAll(() => {
      node.span?.end();
    });

    // Register inner tests/inner describes
    fn();

    // Pop immediately (registration is done); runtime uses beforeAll/afterAll
    testTree.pop();
  });
}
