it.concurrent("it.concurrent", async () => {
  expect(1 + 1).toBe(2);
});

it.todo("it.todo");

it.skip("it.skip", async () => {
  expect(1 + 1).toBe(2);
});

test.concurrent("test.concurrent", async () => {
  expect(1 + 1).toBe(2);
});

test.todo("test.todo");

test.skip("test.skip", async () => {
  expect(1 + 1).toBe(2);
});

test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])(".add(%i, %i)", (a, b, expected) => {
  expect(a + b).toBe(expected);
});

describe.skip("describe.skip", () => {
  test("describe.skip.test", () => {
    expect(1 + 1).toBe(2);
  });
});

describe.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])(".add(%i, %i)", (a, b, expected) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected);
  });

  test(`returned value not be greater than ${expected}`, () => {
    expect(a + b).not.toBeGreaterThan(expected);
  });

  test(`returned value not be less than ${expected}`, () => {
    expect(a + b).not.toBeLessThan(expected);
  });
});
