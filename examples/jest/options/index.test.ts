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

test.failing("test.failing", () => {
  throw new Error("should fail");
});

test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])("test.each.add(%i, %i)", (a, b, expected) => {
  expect(a + b).toBe(expected);
});

test.concurrent.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])("test.concurrent.each.add(%i, %i)", async (a, b, expected) => {
  expect(a + b).toBe(expected);
});

test.concurrent.skip.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])("test.concurrent.skip.each.add(%i, %i)", async (a, b, expected) => {
  expect(a + b).toBe(expected); // will not be run
});

test.failing.each([
  { a: 1, b: 1, expected: 4 },
  { a: 1, b: 2, expected: 4 },
  { a: 2, b: 1, expected: 4 },
])(".add($a, $b)", ({ a, b, expected }) => {
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
])("describe.each.add(%i, %i)", (a, b, expected) => {
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

describe.skip.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])("describe.skip.each.add(%i, %i)", (a, b, expected) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected); // will not be run
  });
});
