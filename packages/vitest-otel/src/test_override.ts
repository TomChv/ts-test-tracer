import * as optl from "@opentelemetry/api";

import * as otr from "@otel-test-runner/instrumentation";

import { testTree } from "./test_tree";
import { runTestInsideSpan } from "./tracer";

function wrapVitestFn(originalFunction: any): any {
  return (
    name: string,
    fn: (...args: any[]) => any | Promise<any> | any,
    options: (...args: any[]) => any | Promise<any> | any,
  ) => {
    const node = testTree[testTree.length - 1];
    const opts = typeof fn === "function" ? options : fn;
    const testFn = typeof fn === "function" ? fn : options;

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

function decorate(original: any) {
  const wrapped = wrapVitestFn(original);
  if (original?.only) wrapped.only = wrapVitestFn(original.only);
  if (original?.skip) wrapped.skip = wrapVitestFn(original.skip);
  if (original?.concurrent) wrapped.concurrent = wrapVitestFn(original.concurrent);
  if (original?.sequential) wrapped.sequential = wrapVitestFn(original.sequential);
  if (original?.fails) wrapped.fails = wrapVitestFn(original.fails);
  if (original?.todo) wrapped.todo = original.todo.bind(original);
  if (original?.each) {
    wrapped.each = (...templ: any[]) => {
      const eachBase = original.each(...templ);
      return wrapVitestFn(eachBase);
    };
  }
  return wrapped;
}

export function instrumentVitestTestFn(testfn: any): any {
  return decorate(testfn);
}
