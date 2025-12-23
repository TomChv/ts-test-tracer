import * as otr from "@otel-test-runner/instrumentation";

/**
 * Initialiaze OTEL when this package is imported
 */
export const sdk = otr.initialize();

export { instrumentVitestDescribeFn } from "./describe_override";
/**
 * Export vitest bindings with automatic tracing.
 */
export { instrumentVitestTestFn } from "./test_override";
