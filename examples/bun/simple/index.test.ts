import { expect } from "bun:test";
import { test, describe } from "bun-otel-test";

test("simple", async () => {
  expect(1 + 1).toBe(2);
});

describe("group-simple", () => {
  test("1 +5", async () => {
    expect(1 + 5).toBe(6);
  });

  test("3 +4", async () => {
    expect(3 + 4).toBe(7);
  });
});
