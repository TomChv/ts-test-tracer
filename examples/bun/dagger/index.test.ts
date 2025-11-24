import { expect } from "bun:test";
import { test, describe } from "@otr/bun-test";

import { connect, connection, dag } from "@dagger.io/dagger";

test(
  "example",
  async () => {
    await connect(async (c) => {
      const res = await c
        .container()
        .from("alpine")
        .withExec(["sleep", "5"])
        .withExec(["echo", "hello", "world"])
        .stdout();
      expect(res, "hello world\n");
    });
  },
  { timeout: 50000 },
);

describe("multiple test", () => {
  test("hello world", async () => {
    await connect(async (c) => {
      const res = await c
        .container()
        .from("alpine")
        .withExec(["echo", "hello", "world"])
        .stdout();
      expect(res, "hello world\n");
    });
  });

  test("global client", async () => {
    await connection(async () => {
      const res = await dag
        .container()
        .from("alpine")
        .withExec(["echo", "hello", "world 2"])
        .stdout();
      expect(res, "hello world 2\n");
    });
  });
});
