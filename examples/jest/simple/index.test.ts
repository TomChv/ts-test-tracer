it("it", async () => {
  expect(1 + 1).toBe(2);
});

test("test", async () => {
  expect(1 + 1).toBe(2);
});

describe("describe", () => {
  it("describe.it", () => {
    expect(1 + 1).toBe(2);
  });

  test("describe.test", () => {
    expect(1 + 1).toBe(2);
  });
});
