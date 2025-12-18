import * as optl from "@opentelemetry/api";
import * as otr from "@otel-test-runner/instrumentation";
import { testTree } from "./test_tree";
import { runTestInsideSpan } from "./tracer";

import * as vitest from "vitest";

function wrapTestFunction(originalFunction: typeof vitest.test): any {
  return (
    name: string,
    fn: (...args: any[]) => any | Promise<any>,
    options: vitest.TestOptions,
  ) => {
    const node = testTree[testTree.length - 1];
    return originalFunction(name, async function (this: any, ...args: any[]) {
      const parentCtx = node?.ctx ?? otr.injectTraceParentInContext();
      return await optl.context.with(
        parentCtx,
        async () => {
          if (fn === undefined) {
            // Create the span if the test is pending but simply do nothing
            return runTestInsideSpan(name, () => {});
          }

          return runTestInsideSpan(name, () => fn.apply(this, args));
        },
        options,
      );
    });
  };
}

const baseTest = wrapTestFunction(vitest.test);

/**
 * @see https://vitest.dev/api/#test
 */
export const it: typeof vitest.test = baseTest;

/**
 * @see https://vitest.dev/api/#test
 */
export const test: typeof vitest.test = baseTest;
