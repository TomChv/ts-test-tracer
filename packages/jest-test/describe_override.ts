import * as jest from "@jest/globals";
import * as optl from "@opentelemetry/api";
import * as otr from "@otel-test-runner/instrumentation";
import formatTitle from "./format_title";
import { type TestTree, testTree } from "./test_tree";
import { tracer } from "./tracer";

function wrapDescribeFunction(
  originalDescribe: typeof jest.describe | typeof jest.describe.skip | typeof jest.describe.only,
): any {
  return (name: string, fn: () => void) => {
    const parent = testTree[testTree.length - 1];
    const node: TestTree = { name, parent };

    // Synchronous: only register hooks and tests here
    return originalDescribe(name, () => {
      // Create a node linked to its parent for proper nesting
      testTree.push(node);

      // Start the group span before any tests in this describe run
      jest.beforeAll(() => {
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
      jest.afterAll(() => {
        node.span?.end();
      });

      // Register inner tests/inner describes
      fn();

      // Pop immediately (registration is done); runtime uses before/after
      testTree.pop();
    });
  };
}

const baseDescribe = wrapDescribeFunction(jest.describe);

baseDescribe.skip = wrapDescribeFunction(jest.describe.skip);

baseDescribe.each = (cases: Array<any>) => {
  return (title: string, fn: (...args: any[]) => void) => {
    cases.forEach((row, index) => {
      const suiteTitle = formatTitle(title, row, index);

      if (Array.isArray(row)) {
        // Spread array items as individual args
        baseDescribe(suiteTitle, () => fn(...row));
      } else {
        // Pass non-array rows as a single arg
        baseDescribe(suiteTitle, () => fn(row));
      }
    });
  };
};

/**
 * @see https://jestjs.io/docs/api
 */
export const describe: typeof jest.describe = baseDescribe;
