import assert from "node:assert";

import { it, describe } from "@otel-test-runner/mocha-test";
import { connect, connection, dag } from "@dagger.io/dagger";

it("example", async () => {
  await connect(async (c) => {
    const res = await c
      .container()
      .from("alpine")
      .withExec(["sleep", "5"])
      .withExec(["echo", "hello", "world"])
      .stdout();
    assert.strictEqual(res, "hello world\n");
  });
}).timeout(15000);

describe("multiple test", () => {
  it("hello world", async () => {
    await connect(async (c) => {
      const res = await c
        .container()
        .from("alpine")
        .withExec(["echo", "hello", "world"])
        .stdout();
      assert.strictEqual(res, "hello world\n");
    });
  }).timeout(5000);

  it("global client", async () => {
    await connection(async () => {
      const res = await dag
        .container()
        .from("alpine")
        .withExec(["echo", "hello", "world 2"])
        .stdout();
      assert.strictEqual(res, "hello world 2\n");
    });
  }).timeout(15000);
});
