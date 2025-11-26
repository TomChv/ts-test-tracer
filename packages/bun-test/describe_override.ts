import * as bunTest from "bun:test";
import * as optl from "@opentelemetry/api";
import * as otr from "@otel-test-runner/instrumentation";

import { type TestTree, testTree } from "./test_tree";
import { tracer } from "./tracer";
import { formatTitle } from "./util";

/******************
 * Mirror of `bun-test.describe` with traces so groups can be traces by simply
 * changing the import but any existing utility methods are kept.
 *******************/

function wrapDescribeFunction(originalDescribe: typeof bunTest.describe): any {
  return (name: string, fn: () => void) => {
    const parent = testTree[testTree.length - 1];
    const node: TestTree = { name, parent };

    // Synchronous: only register hooks and tests here
    return originalDescribe(name, () => {
      // Create a node linked to its parent for proper nesting
      testTree.push(node);

      // Start the group span before any tests in this describe run
      bunTest.beforeAll(() => {
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
      bunTest.afterAll(() => {
        node.span?.end();
      });

      // Register inner tests/inner describes
      fn();

      // Pop immediately (registration is done); runtime uses beforeAll/afterAll
      testTree.pop();
    });
  };
}

const baseDescribe = wrapDescribeFunction(bunTest.describe);

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

baseDescribe.concurrent = wrapDescribeFunction(bunTest.describe.concurrent);
baseDescribe.only = wrapDescribeFunction(bunTest.describe.only);
baseDescribe.serial = wrapDescribeFunction(bunTest.describe.serial);
baseDescribe.skip = wrapDescribeFunction(bunTest.describe.skip);
baseDescribe.todo = wrapDescribeFunction(bunTest.describe.todo);

baseDescribe.if = (condition: boolean) => {
  if (condition === true) {
    return baseDescribe;
  }

  return bunTest.describe.skip;
};

baseDescribe.skipIf = (condition: boolean) => {
  if (condition === true) {
    return bunTest.describe.skip;
  }

  return baseDescribe;
};

baseDescribe.todoIf = (condition: boolean) => {
  if (condition === true) {
    return bunTest.describe.todo;
  }

  return baseDescribe;
};

/**
 * @see https://bun.com/docs/test/writing-tests
 */
export const describe: typeof bunTest.describe = baseDescribe;
