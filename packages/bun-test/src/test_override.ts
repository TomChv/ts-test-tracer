/******************
 * Mirror of `bun-test.test` with traces so tests can be traces by simply
 * changing the import but any existing utility methods are kept.
 *******************/

import * as bunTest from "bun:test";
import * as optl from "@opentelemetry/api";
import * as otr from "@otel-test-runner/instrumentation";

import { testTree } from "./test_tree";
import { runTestInsideSpan } from "./tracer";
import { formatTitle } from "./util";

function wrapTestFunction(originalFunction: typeof bunTest.test): any {
  return (name: string, fn: () => any | Promise<any>, options?: any) => {
    const node = testTree[testTree.length - 1];
    return originalFunction(
      name,
      async () => {
        const parentCtx = node?.ctx ?? otr.injectTraceParentInContext();
        await optl.context.with(parentCtx, async () => {
          await runTestInsideSpan(name, fn);
        });
      },
      options,
    );
  };
}

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
    bunTest.test.if?.(condition) ?? ((condition ? bunTest.test : bunTest.test.skip) as any);

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
    bunTest.test.skipIf?.(condition) ?? ((condition ? bunTest.test : bunTest.test.skip) as any);
  return wrapTestFunction(registrar);
};

baseTest.todoIf = (condition: boolean) => {
  const registrar =
    bunTest.test.todoIf?.(condition) ?? ((condition ? bunTest.test : bunTest.test.skip) as any);
  return wrapTestFunction(registrar);
};

baseTest.failingIf = (condition: boolean) => {
  const registrar =
    bunTest.test.failingIf?.(condition) ?? ((condition ? bunTest.test : bunTest.test.skip) as any);
  return wrapTestFunction(registrar);
};

baseTest.serialIf = (condition: boolean) => {
  const registrar =
    bunTest.test.serialIf?.(condition) ?? ((condition ? bunTest.test : bunTest.test.skip) as any);
  return wrapTestFunction(registrar);
};

baseTest.each = (cases: Array<any>) => {
  return (title: string, fn: (...args: any[]) => any | Promise<any>, options?: any) => {
    cases.forEach((row, index) => {
      const testTitle = formatTitle(title, row, index);

      if (Array.isArray(row)) {
        // Spread array items as individual args
        baseTest(testTitle, () => fn(...row), options);
      } else {
        // Pass non-array rows as a single arg
        baseTest(testTitle, () => fn(row), options);
      }
    });
  };
};

/**
 * @see https://bun.com/docs/test/writing-tests
 */
export const test: typeof bunTest.test = baseTest;
