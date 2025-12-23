import { expect } from "vitest";

test("hello world", () => {
  expect(1 + 1).toBe(2);
});

describe("hello suite", () => {
  test("my cool test", () => {
    expect(1 + 1).toBe(2);
  });
});
