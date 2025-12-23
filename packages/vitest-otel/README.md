# Mocha OTEL Test library

A wrapper around [`vitest`](https://vitest.dev/) to automatically traces tests inside `dagger run` or `dagger call`.

### Installation

```shell
npm install @otel-test-runner/vitest-otel
```

### Usage

Update `vitest.config.js` to use globals `js` and calling the setup files.

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.js"],
  },
});
```

This will add instrumentation for `test` and `describe` when using dagger.
It cannot be use with the official `vitest` instrumentation because the traces
will not be properly flushed by the auto support.

```js
//vitest.setup.ts
import { test, describe } from "vitest";

import {
  instrumentVitestTestFn,
  instrumentVitestDescribeFn,
} from "@otel-test-runner/vitest-otel";
import { sdk } from "@otel-test-runner/vitest-otel";

globalThis.test = instrumentVitestTestFn(test);
globalThis.describe = instrumentVitestDescribeFn(describe);

globalThis.afterAll(async () => {
  await sdk.shutdown();
});
```

Use `test` and `describe` from global vitest.

```ts
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
