import { test as _test, type TestOptions } from "vitest";
import * as optl from "@opentelemetry/api";

import * as otr from "@otel-test-runner/instrumentation";

import { testTree } from "./test_tree";
import { runTestInsideSpan } from "./tracer";

export function wrapTestFunction(originalFunction: typeof _test): any {
  return (
    name: string,
    fn: (...args: any[]) => any | Promise<any> | TestOptions,
    options: (...args: any[]) => any | Promise<any> | TestOptions,
  ) => {
    const node = testTree[testTree.length - 1];
    let opts = typeof fn === "function" ? options : fn;
    let testFn = typeof fn === "function" ? fn : options;

    return originalFunction(name, async function (this: any, ...args: any[]) {
      const parentCtx = node?.ctx ?? otr.injectTraceParentInContext();
      return await optl.context.with(
        parentCtx,
        async () => {
          if (testFn === undefined) {
            // Create the span if the test is pending but simply do nothing
            return runTestInsideSpan(name, () => {});
          }

          return runTestInsideSpan(name, () => testFn.apply(this, args));
        },
        opts,
      );
    });
  };
}
