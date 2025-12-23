import * as optl from "@opentelemetry/api";
import * as otr from "@otel-test-runner/instrumentation";

import { type TestTree, testTree } from "./test_tree";
import { tracer } from "./tracer";

function wrapDescribeFunction(originalDescribe: any): any {
  return (name: string, fn: () => void) => {
    const parent = testTree[testTree.length - 1];
    const node: TestTree = { name, parent };

    // Synchronous: only register hooks and tests here
    return originalDescribe(name, () => {
      // Create a node linked to its parent for proper nesting
      testTree.push(node);

      // Start the group span before any tests in this describe run
      (global as any).beforeAll(() => {
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
      (global as any).afterAll(() => {
        node.span?.end();
      });

      // Register inner tests/inner describes
      fn();

      // Pop immediately (registration is done); runtime uses before/after
      testTree.pop();
    });
  };
}

export function instrumentVitestDescribeFn(original: any): any {
  return wrapDescribeFunction(original);
}
