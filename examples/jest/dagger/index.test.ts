import { connect, connection, dag } from "@dagger.io/dagger";

it("example", async () => {
  await connect(async (c) => {
    const res = await c
      .container()
      .from("alpine")
      .withExec(["sleep", "5"])
      .withExec(["echo", "hello", "world"])
      .stdout();
    expect(res).toBe("hello world\n");
  });
}, 15000);

describe("multiple test", () => {
  it("hello world", async () => {
    await connect(async (c) => {
      const res = await c
        .container()
        .from("alpine")
        .withExec(["echo", "hello", "world"])
        .stdout();
      expect(res).toBe("hello world\n");
    });
  }, 5000);

  it("global client", async () => {
    await connection(async () => {
      const res = await dag
        .container()
        .from("alpine")
        .withExec(["echo", "hello", "world 2"])
        .stdout();
      expect(res).toBe("hello world 2\n");
    });
  }, 5000);
});
