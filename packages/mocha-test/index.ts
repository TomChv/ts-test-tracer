import * as otr from "@otel-test-runner/instrumentation";

/**
 * Initialiaze OTEL when this package is imported
 */
otr.initialize();

/**
 * Override global.after to call otr.close()
 */
global.after(async () => {
  try {
    await otr.close();
  } catch {
    console.warn("[WARN] couldn't close otel client");
  }
});

export { context, describe, suite } from "./describe_override";
/**
 * Export mocha bindings with automatic tracing.
 */
export { it, specify, test } from "./test_override";
