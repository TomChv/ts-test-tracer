import * as jest from "@jest/globals";
import * as optl from "@opentelemetry/api";
import * as otr from "@otel-test-runner/instrumentation";
import formatTitle from "./format_title";
import { testTree } from "./test_tree";
import { runTestInsideSpan } from "./tracer";

function wrapTestFunction(
  originalFunction:
    | typeof jest.it
    | typeof jest.it.skip
    | typeof jest.it.only
    | typeof jest.it.todo
    | typeof jest.it.failing
    | typeof jest.it.concurrent,
): any {
  return (name: string, fn: (...args: any[]) => any | Promise<any>, timeout?: number) => {
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
        timeout,
      );
    });
  };
}

const baseTest = wrapTestFunction(jest.it);

baseTest.skip = wrapTestFunction(jest.it.skip);
baseTest.only = wrapTestFunction(jest.it.only);
baseTest.todo = jest.it.todo;
baseTest.failing = wrapTestFunction(jest.it.failing);
baseTest.concurrent = wrapTestFunction(jest.it.concurrent);
baseTest.each = (cases: Array<any>) => {
  return (title: string, fn: (...args: any[]) => any | Promise<any>, timeout?: number) => {
    cases.forEach((row, index) => {
      const testTitle = formatTitle(title, row, index);

      if (Array.isArray(row)) {
        // Spread array items as individual args
        baseTest(testTitle, () => fn(...row), timeout);
      } else {
        // Pass non-array rows as a single arg
        baseTest(testTitle, () => fn(row), timeout);
      }
    });
  };
};

/**
 * @see https://jestjs.io/docs/api
 */
export const it: typeof jest.it = baseTest;

/**
 * @see https://jestjs.io/docs/api
 */
export const test: typeof jest.test = baseTest;
