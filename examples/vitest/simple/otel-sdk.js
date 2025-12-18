import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { propagation, trace } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

/**
 * Live span processor implementation.
 *
 * It's a BatchSpanProcessor whose on_start calls on_end on the underlying
 * SpanProcessor in order to send live telemetry.
 */
class LiveProcessor extends BatchSpanProcessor {
  onStart(_span, _parentContext) {
    this.onEnd(_span);
  }
}

const TEST_NAME_ID_KEY = Symbol("TEST_NAME_ID_KEY");
const SUITE_NAME_ID_KEY = Symbol("SUITE_NAME_ID_KEY");

class MyContextManager extends AsyncLocalStorageContextManager {
  /**
   * This is actually one of the weirdest workaround I did so far but here's the explanation:
   * When Vitest instrument the tests execution, it creates a *loooot* of traces and essentially
   * we only want to keep what's inside actuals tests.
   *
   * The issue is that traces produces inside tests are in `vitest.test.runner.run.test`
   * but that parent creates 3 children span:
   * - vitest.test.runner.test.beforeEach
   * - vitest.test.runner.test.callback
   * - vitest.test.runner.test.afterEach
   * We only want to keep the traces inside `vitest.test.runner.test.callback` because it's the
   * actual execution.
   *
   * So for each tests, we count the number of `vitest.test.runner.run.test` and make the
   * on that creates `vitest.test.runner.test.callback` the trace parent, so other can be ignored.
   *
   * It's quite ugly but since context are immutable, we cannot just rewrite the parent
   * from `vitest.test.runner.test.callback` span.
   * We also cannot create a span from `vitest.test.runner.test.callback` because it will never end and
   * we cannot define `vitest.test.runner.test.callback` because then the test name will never be written.
   */
  testCounter = {};
  suiteCounter = {};

  spanLinkedToSuite = false;
  remotetoLink = false;

  active() {
    const ctx = super.active();
    const currentSpan = trace.getSpan(ctx);

    if (currentSpan === undefined) {
      return ctx;
    }

    switch (currentSpan.name) {
      case "vitest.test.runner.run.suite": {
        const suiteName = currentSpan.attributes["vitest.suite.name"];
        const suite = ctx.getValue(SUITE_NAME_ID_KEY);
        const ctxWithSuiteName = ctx.setValue(SUITE_NAME_ID_KEY, suiteName);

        if (this.suiteCounter[suiteName] === undefined) {
          this.suiteCounter[suiteName] = 0;
        }

        this.suiteCounter[suiteName] += 1;

        console.log(this.suiteCounter);

        console.log(this.testCounter, this.suiteCounter);

        // It's the span we want to instrumentation
        if (this.suiteCounter[suiteName] >= 2) {
          console.log("suite", { suiteName, insideSuide: suite });

          if (suite !== undefined) {
            currentSpan.updateName(suite);

            return ctxWithSuiteName;
          }

          console.log("setting suite as parent", { suiteName });

          return propagation.extract(ctxWithSuiteName, {
            traceparent: process.env.TRACEPARENT,
          });
        }

        return ctxWithSuiteName;
      }

      case "vitest.test.runner.run.test": {
        const testName = currentSpan.attributes["vitest.test.name"];
        const ctxWithTestName = ctx.setValue(TEST_NAME_ID_KEY, testName);
        const suiteName = ctx.getValue(SUITE_NAME_ID_KEY);

        if (this.testCounter[testName] === undefined) {
          this.testCounter[testName] = 0;
        }

        this.testCounter[testName] += 1;

        // It's the span we want to instrumentation
        if (this.testCounter[testName] === 2) {
          console.log("-- test ", {
            testName,
            suiteName,
            linked: this.spanLinkedToSuite,
          });

          if (suiteName !== undefined) {
            if (this.spanLinkedToSuite === false) {
              currentSpan.updateName(suiteName);
            }

            console.log("test inside suite, updating name...", {
              testName,
              suiteName,
            });

            return ctxWithTestName;
          }

          console.log("test outside suite...", {
            testName,
            suiteName,
          });

          return propagation.extract(ctxWithTestName, {
            traceparent: process.env.TRACEPARENT,
          });
        }

        return ctxWithTestName;
      }
      case "vitest.test.runner.test.callback": {
        console.log("---- callback", {
          name: ctx.getValue(TEST_NAME_ID_KEY),
          suite: ctx.getValue(SUITE_NAME_ID_KEY),
        });

        currentSpan.updateName(ctx.getValue(TEST_NAME_ID_KEY));

        return ctx;
      }
      default:
        return ctx;
    }
  }
}

/**
 * Batch span processor scheduler delays.
 * We set to 100ms so it's almost live.
 */
const NEARLY_IMMEDIATE = 100;
const OTEL_TEST_RUNNER_SERVICE_NAME = "otel-typescript-test-runner";

const exporter = new OTLPTraceExporter();
const processor = new LiveProcessor(exporter, {
  scheduledDelayMillis: NEARLY_IMMEDIATE,
});

const otelSDK = new NodeSDK({
  serviceName: OTEL_TEST_RUNNER_SERVICE_NAME,
  spanProcessors: [processor],
  // contextManager: new MyContextManager(),
});

otelSDK.start();

export default otelSDK;
