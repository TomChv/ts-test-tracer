# Bun OTEL Test library

A wrapper around [`mocha`](https://mochajs.org/next/) to automatically traces tests inside `dagger run` or `dagger call`.

### Installation

```shell
npm install @otel-test-runner/mocha-test
```

### Usage

Instead of using the global `it`, `describe` etc..., import them from `@otel-test-runner/mocha-test`.

```ts
import assert from "node:assert";

import { it, describe } from "@otel-test-runner/mocha-test";

it("single test", async () => {
  assert.strictEqual(1 + 1, 2);
});

describe("test suite", () => {
  it("hello world", () => {
    assert.strictEqual(1 + 1, 2);
  });
```

### Current support

- [x] it
- [x] specify
- [x] describe
- [x] context
- [x] `it|specify`.`skip|only`
- [ ] `describe|context`.`skip|only`
- [ ] this.`timeout|retries`
- [ ] tests.`forEach`
- [ ] [`QUnit`](https://mochajs.org/next/interfaces/qunit/) interface
- [ ] [`TDD`](https://mochajs.org/next/interfaces/tdd/) interface

### Dagger integration

You can automatically view your traces on Dagger Cloud with that library.

![dagger-cloud-view-example](./assets/dagger-cloud-view-example.png)
