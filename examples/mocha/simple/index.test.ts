import assert from "node:assert";

import { it, describe, context, specify } from "@otel-test-runner/mocha-test";

it("it", async () => {
  assert.strictEqual(1 + 1, 2);
});

specify("specify", async () => {
  assert.strictEqual(1 + 1, 2);
});

describe("describe", () => {
  it("describe.it", () => {
    assert.strictEqual(1 + 1, 2);
  });

  specify("describe.specify", () => {
    assert.strictEqual(1 + 1, 2);
  });

  context("describe.context", () => {
    it("describe.context.it", () => {
      assert.strictEqual(1 + 1, 2);
    });

    specify("describe.context.specify", () => {
      assert.strictEqual(1 + 1, 2);
    });
  });
});

context("context", () => {
  it("context.it", () => {
    assert.strictEqual(1 + 1, 2);
  });

  specify("context.specify", () => {
    assert.strictEqual(1 + 1, 2);
  });

  describe("context.describe", () => {
    it("context.describe.it", () => {
      assert.strictEqual(1 + 1, 2);
    });

    specify("context.describe.specify", () => {
      assert.strictEqual(1 + 1, 2);
    });
  });
});
