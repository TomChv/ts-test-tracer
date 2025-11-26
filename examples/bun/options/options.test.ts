import { test } from "@otel-test-runner/bun-test";
import { expect } from "bun:test";

/****************
 * Test the standard modifiers
 ****************/
test.concurrent(
  "test.concurrent and timeout = 8s",
  async () => {
    await Bun.sleep(1000 * 6);
    expect(1 + 1).toBe(2);
  },
  { timeout: 8000 },
);

test.concurrent("test.concurrent", async () => {
  await Bun.sleep(1000 * 3);
  expect(1 + 1).toBe(2);
});

test.serial("test.serial", () => {
  expect(2 + 2).toBe(4);
});

test.skip("test.skip", () => {
  console.log("skipped");
});

test.failing("test.failing", () => {
  throw new Error("faling");
});

test.if(false)("test.if(false)", () => {
  console.log("never executed");
});

test.if(true)("test.if(true)", () => {
  expect(1 + 1).toBe(2);
});

test.todo("test.todo", () => {
  console.log("never executed");
});

/****************
 * Test the conditional modifiers
 ****************/

test.todoIf(false)("todoIf 1 + 1 != 2", () => {
  expect(1 + 3).toBe(4);
});

test.todoIf(true)("todoIf 1 + 1 === 2", () => {
  console.log("should never run");
});

test.skipIf(true)("test.skipIf(true)", () => {
  console.log("should never run");
});

test.skipIf(false)("test.skipIf(false)", () => {
  expect(1 + 3).toBe(4);
});

test.failingIf(false)("test.failingIf(false)", () => {
  expect(1 + 3).toBe(4);
});

test.failingIf(true)("test.failingIf(true)", () => {
  throw new Error("should fail");
});

test.concurrentIf(false)("test.concurrentIf(false)", () => {
  expect(1 + 1).toBe(2);
});

test.concurrentIf(true)("test.concurrentIf(true)", () => {
  expect(1 + 1).toBe(2);
});

test.serialIf(false)("test.serialIf(false)", () => {
  expect(1 + 1).toBe(2);
});

test.serialIf(true)("test.serialIf(true)", () => {
  expect(1 + 1).toBe(2);
});

/****************
 * Test the `each` modifiers
 ****************/

const cases = [
  [1, 2, 3],
  [3, 4, 7],
];

test.each(cases)("test.each[%p + %p should be %p]", (a, b, expected) => {
  expect(a + b).toBe(expected);
});
