import * as optl from "@opentelemetry/api";
import * as otr from "@otel-test-runner/instrumentation";
import { testTree } from "./test_tree";
import { runTestInsideSpan } from "./tracer";

function wrapTestFunction(
  originalFunction: typeof global.it | typeof global.it.skip | typeof global.it.only,
): any {
  return (name: string, fn: (...args: any[]) => any | Promise<any>) => {
    const node = testTree[testTree.length - 1];
    return originalFunction(name, async function (this: any, ...args: any[]) {
      const parentCtx = node?.ctx ?? otr.injectTraceParentInContext();
      return await optl.context.with(parentCtx, async () => {
        if (fn === undefined) {
          // Create the span if the test is pending but simply do nothing
          return runTestInsideSpan(name, () => {});
        }

        return runTestInsideSpan(name, () => fn.apply(this, args));
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

/**
 * @see https://mochajs.org/next/interfaces/qunit/
 */
export const test: typeof global.test = baseTest;
