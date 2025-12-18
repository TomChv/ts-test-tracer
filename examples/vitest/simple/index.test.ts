import { expect, describe, afterAll } from "vitest";
import { trace } from "@opentelemetry/api";
import * as otr from "@otel-test-runner/instrumentation"

import { test } from "./wrapper"

const tracer = trace.getTracer("test");

afterAll(async () => {
  await otr.close()
})

function sum(a: number, b: number) {
  return a + b;
}

 test("test-1", async () => {
   await tracer.startActiveSpan("hello world", async (span) => {
     expect(sum(1, 2)).toBe(3);
 
     span.end();
   });
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
