import { test as _test, expect, describe, afterAll } from "vitest";

import { wrapTestFunction } from "@otel-test-runner/vitest-otel";

const test = wrapTestFunction(_test)

// const tracer = trace.getTracer("test");

function sum(a: number, b: number) {
  return a + b;
}

test("test-1", async () => {
  // await tracer.startActiveSpan("hello world", async (span) => {
  expect(sum(1, 2)).toBe(3);

  // span.end();
  //  });
});
//
// test("test-2", async () => {
//   await tracer.startActiveSpan("hello world", async (span) => {
//     expect(sum(1, 2)).toBe(3);
//
//     span.end();
//   });
// });

// describe("describe", async () => {
//   test("describe.test-1", async () => {
//     await tracer.startActiveSpan("hello world", async (span) => {
//       expect(sum(1, 2)).toBe(3);
//
//       span.end();
//     });
//   });
//
//   test("describe.test-2", async () => {
//     await tracer.startActiveSpan("hello world", async (span) => {
//       expect(sum(1, 2)).toBe(3);
//
//       span.end();
//     });
//   });
// });
