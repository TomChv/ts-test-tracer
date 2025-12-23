import * as otr from "@otel-test-runner/instrumentation";

/**
 * Initialiaze OTEL when this package is imported
 */
export const sdk = otr.initialize();

/**
 * Export vitest bindings with automatic tracing.
 */
export { instrumentVitestTestFn } from "./test_override";
export { instrumentVitestDescribeFn } from "./describe_override";
