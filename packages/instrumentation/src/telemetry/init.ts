import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { NodeSDK } from "@opentelemetry/sdk-node";

import { LiveProcessor } from "./live_processor.js";

/**
 * Batch span processor scheduler delays.
 * We set to 100ms so it's almost live.
 */
const NEARLY_IMMEDIATE = 100;
const OTEL_TEST_RUNNER_SERVICE_NAME = "otel-typescript-test-runner";

/**
 * Private global env variable to store the OTEL SDK configuration.
 */
let otelSDK: NodeSDK | undefined;

/**
 * Initialization function to call before instrumenting
 * tests.
 *
 * This should be called before the run are registered.
 *
 * The configuration is based on standard OTEL environment
 * variables.
 */
export function initialize(): NodeSDK {
  if (otelSDK !== undefined) {
    return otelSDK;
  }

  const exporter = new OTLPTraceExporter();
  const processor = new LiveProcessor(exporter, {
    scheduledDelayMillis: NEARLY_IMMEDIATE,
  });

  otelSDK = new NodeSDK({
    serviceName: OTEL_TEST_RUNNER_SERVICE_NAME,
    spanProcessors: [processor],
  });

  otelSDK.start();

  return otelSDK;
}

/**
 * Close function to shutdown the OTEL SDK client and
 * flush any remaining spans.
 */
export async function close(): Promise<void> {
  if (otelSDK !== undefined) {
    await otelSDK.shutdown();
  }
}
