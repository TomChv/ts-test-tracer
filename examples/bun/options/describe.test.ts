import { test, describe } from "@otel-test-runner/bun-test";
import { expect } from "bun:test";

/****************
 * Test describe modifiers
 ****************/

describe.concurrent("describe.concurrent", () => {
  test("describe.concurrent.test 1", () => {
    expect(1 + 1).toBe(2);
  });

  test("describe.concurrent.test 2", () => {
    expect(1 + 1).toBe(2);
  });
});

describe.serial("describe.serial", () => {
  test("describe.serial.test 1", () => {
    expect(1 + 1).toBe(2);
  });

  test("describe.serial.test 2", () => {
    expect(1 + 1).toBe(2);
  });
});

describe.skip("describe.skip", () => {
  test("should never run", () => {
    expect(1 + 1).toBe(2);
  });
});

describe.todo("describe.todo", () => {
  test("should never run", () => {
    expect(1 + 1).toBe(2);
  });
});

describe.if(false)("describe.if(false)", () => {
  test("should never run", () => {
    expect(1 + 1).toBe(2);
  });
});

describe.if(true)("describe.if(true)", () => {
  test("describe.if(true).test", () => {
    expect(1 + 1).toBe(2);
  });
});

/****************
 * Test describe confiditional modifiers
 ****************/

describe.skipIf(false)("describe.skipIf(false)", () => {
  test("describe.skipIf(false).test", () => {
    expect(1 + 1).toBe(2);
  });
});

describe.skipIf(true)("describe.skipIf(false)", () => {
  test("should never run", () => {
    expect(1 + 1).toBe(2);
  });
});

describe.todoIf(false)("describe.todoIf(false)", () => {
  test("describe.todoIf(false).test", () => {
    expect(1 + 1).toBe(2);
  });
});

describe.todoIf(true)("describe.todoIf(true)", () => {
  test("should never run", () => {
    expect(1 + 1).toBe(2);
  });
});

/****************
 * Test the `each` modifiers
 ****************/

describe.each([
  [1, 2, 3],
  [3, 4, 7],
])("add(%i, %i)", (a, b, expected) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected);
  });

  test(`sum is greater than each value`, () => {
    expect(a + b).toBeGreaterThan(a);
    expect(a + b).toBeGreaterThan(b);
  });
});
