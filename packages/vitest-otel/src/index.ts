import * as otr from "@otel-test-runner/instrumentation";

/**
 * Initialiaze OTEL when this package is imported
 */
export const sdk = otr.initialize();

// export { describe } from "./describe_override";

/**
 * Export vitest bindings with automatic tracing.
 */
export { wrapTestFunction } from "./test_override";
