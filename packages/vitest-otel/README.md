# Mocha OTEL Test library

A wrapper around [`vitest`](https://vitest.dev/) to automatically traces tests inside `dagger run` or `dagger call`.

### Installation

```shell
npm install @otel-test-runner/vitest-otel
```

### Usage

Instead of using the global `it`, `describe` etc..., import them from `@otel-test-runner/vitest-otel`.

```ts
import assert from "node:assert";

import { test, describe } from "@otel-test-runner/vitest-test";
import { expect } from "vitest"

test("single test", async () => {
  expect(1 + 1).toBe(2);
});

describe("test suite", () => {
  test("hello world", () => {
    expect(1 + 1).toBe(2);
  });
```

### Current support

### Dagger integration

You can automatically view your traces on Dagger Cloud with that library.

![dagger-cloud-view-example](./assets/dagger-cloud-view-example.png)
