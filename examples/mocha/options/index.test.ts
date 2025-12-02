import assert from "node:assert";

import {
  it,
  describe,
  specify,
  context,
  suite,
  test,
} from "@otel-test-runner/mocha-test";

it("it.function.withTimeout", async function () {
  this.timeout(6000);
  assert.ok(this.slow() <= 300);
  assert.strictEqual(1 + 1, 2);
});

specify("specify.function.withTimeout", async function () {
  this.timeout(6000);
  assert.ok(this.slow() <= 300);
  assert.strictEqual(1 + 1, 2);
});

describe("describe.withEmbeddedFunc", function () {
  const testAdd = ({
    args,
    expected,
  }: {
    args: Array<number>;
    expected: number;
  }) => {
    return function () {
      const res = args.reduce((acc, cur) => (acc += cur), 0);
      assert.strictEqual(res, expected);
    };
  };

  it("correctly adds 2 args", testAdd({ args: [1, 2], expected: 3 }));
  it("correctly adds 3 args", testAdd({ args: [1, 2, 3], expected: 6 }));
  it("correctly adds 4 args", testAdd({ args: [1, 2, 3, 4], expected: 10 }));
});

describe("tests.forEach", function () {
  const tests = [
    { args: [1, 2], expected: 3 },
    { args: [1, 2, 3], expected: 6 },
    { args: [1, 2, 3, 4], expected: 10 },
  ];

  tests.forEach(({ args, expected }) => {
    it(`correctly adds ${args.length} args`, function () {
      const res = args.reduce((acc, cur) => (acc += cur), 0);
      assert.strictEqual(res, expected);
    });
  });
});

// pending test below
it("pending-test");

// Test QUnit interface
suite("suite", () => {
  test("suite.test", () => {
    assert.strictEqual(1 + 1, 2);
  });
});

test("test", function () {
  assert.strictEqual(1 + 1, 2);
});

describe.skip("describe.skip", () => {});
suite.skip("suite.skip", () => {});
context.skip("context.skip", () => {});
