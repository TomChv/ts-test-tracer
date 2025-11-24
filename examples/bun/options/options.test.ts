import { test, describe } from "@otel-test-runner/bun-test";
import { expect } from "bun:test";

/**
 * Test timeout configuration
 * The default timeout is 5second so if that test pass,
 */
test(
  "timeout configuration",
  async () => {
    await Bun.sleep(1000 * 6);
    expect(1 + 1).toBe(2);
  },
  { timeout: 8000 }
);
