import * as otr from "@otel-test-runner/instrumentation";
import { afterAll } from "vitest";

/**
 * Initialiaze OTEL when this package is imported
 */
otr.initialize();

/**
 * Override global.after to call otr.close()
 */
afterAll(async () => {
  try {
    await otr.close();
  } catch {
    console.warn("[WARN] couldn't close otel client");
  }
});

// export { describe } from "./describe_override";

/**
 * Export mocha bindings with automatic tracing.
 */
export { test } from "./test_override";
