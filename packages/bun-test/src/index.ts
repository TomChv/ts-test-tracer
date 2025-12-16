import * as bunTest from "bun:test";
import * as otr from "@otel-test-runner/instrumentation";

/**
 * On import, we automatically initialize telemetry so spans
 * can be created when creating tests groups.
 */
otr.initialize();

/**
 * Shutdown telemetry after tests are completed.
 * This hook is automatically register on Bun tests runners
 * when imported
 */
bunTest.afterAll(async () => {
  await otr.close();
});

export { describe } from "./describe_override";
export { test } from "./test_override";
