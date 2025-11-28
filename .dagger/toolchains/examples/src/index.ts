/**
 * A toolchain to manage examples.
 *
 * The tests are pointing `@otel-test-runner/bun-test` to its local version
 * so it can run example with unpublished changes.
 */

import {
  dag,
  Directory,
  object,
  func,
  argument,
  check,
  Changeset,
} from "@dagger.io/dagger";
import { getTracer } from "@dagger.io/dagger/telemetry";
import { trimSuffix } from "./utils";

const BUN_CONTAINER_IMAGE =
  "oven/bun:1.3-alpine@sha256:d2bc1fbc3afcd3d70afc2bb2544235bf559caae2a3084e9abed126e233797511";

const NODE_CONTAINER_IMAGE =
  "node:24.11.1-alpine3.22@sha256:2867d550cf9d8bb50059a0fff528741f11a84d985c732e60e19e8e75c7239c43";

@object()
export class Examples {
  @func()
  originalSourceCodeWorkspace: Directory;

  @func()
  sourceCodeWorkspace: Directory;

  constructor(
    @argument({
      defaultPath: "/",
      ignore: [
        "*",
        "!packages/*",
        "packages/*/node_modules",
        "packages/*/assets",
        "packages/*/.gitignore",
        "packages/*/*.md",
      ],
    })
    sourceCodeWorkspace: Directory,
  ) {
    this.originalSourceCodeWorkspace = sourceCodeWorkspace;

    const testRunnerPkgs = ["mocha-test", "bun-test"];
    const allPkg = ["instrumentation", ...testRunnerPkgs];

    let ctr = dag
      .container()
      .from(BUN_CONTAINER_IMAGE)
      .withDirectory("/src", sourceCodeWorkspace);

    // Update test runner packages to use local instrumentation.
    for (const testRunnerPkg of testRunnerPkgs) {
      ctr = ctr
        .withWorkdir(`/src/packages/${testRunnerPkg}`)
        .withExec([
          "bun",
          "pm",
          "pkg",
          "set",
          "dependencies[@otel-test-runner/instrumentation]=../instrumentation",
        ]);
    }

    // Install and build local packages.
    for (const pkg of allPkg) {
      ctr = ctr
        .withWorkdir(`/src/packages/${pkg}`)
        .withExec(["bun", "install"])
        .withExec(["bun", "run", "build"]);
    }

    // Update dependency to be local so we can test the local code.
    this.sourceCodeWorkspace = ctr.directory("/src");
  }

  /**
   * Return a Bun container with packages and examples mounted in it.
   *
   * This should be used for debug purpose.
   */
  @func()
  container(
    @argument({
      defaultPath: "/",
      ignore: [
        "*",
        "!examples/",
        "examples/**/*/node_modules",
        "examples/**/*/*.md",
        "examples/**/*/.gitignore",
      ],
    })
    exampleWorkspace: Directory,
  ) {
    return dag
      .container()
      .from(BUN_CONTAINER_IMAGE)
      .withWorkdir("/src")
      .withMountedDirectory("/src", this.sourceCodeWorkspace)
      .withMountedDirectory(
        "/src/examples",
        exampleWorkspace.directory("examples"),
      )
      .withWorkdir("/src/examples");
  }

  /**
   * Execute all the Bun examples in the project
   */
  @check()
  @func()
  async testBun(
    @argument({
      defaultPath: "/",
      ignore: [
        "*",
        "!examples/bun",
        "examples/bun/*/node_modules",
        "examples/bun/*/*.md",
        "examples/bun/*/.gitignore",
      ],
    })
    bunExampleWorkspace: Directory,
  ): Promise<void> {
    const bunDirectory = bunExampleWorkspace.directory("examples/bun");
    const examples = (await bunDirectory.entries()).map((dir) =>
      trimSuffix(dir, "/"),
    );

    await Promise.all(
      examples.map(async (example) => {
        await getTracer().startActiveSpan(example, async () => {
          const ctr = dag
            .container()
            .from(BUN_CONTAINER_IMAGE)
            .withWorkdir("/src")
            .withMountedDirectory("/src", this.sourceCodeWorkspace)
            .withMountedDirectory(
              "/src/example",
              bunDirectory.directory(example),
            )
            .withWorkdir("/src/example");

          await getTracer().startActiveSpan("latest version", async () => {
            await ctr
              .withExec(["bun", "install"])
              .withExec(["bun", "test"], {
                experimentalPrivilegedNesting: true,
              })
              .sync();
          });

          await getTracer().startActiveSpan("local version", async () => {
            await ctr
              .withExec([
                "bun",
                "pm",
                "pkg",
                "set",
                "devDependencies[@otel-test-runner/bun-test]=../packages/bun-test",
              ])
              .withoutFile("bun.lock")
              .withExec(["bun", "install"])
              .withExec(["bun", "test"], {
                experimentalPrivilegedNesting: true,
              })
              .sync();
          });
        });
      }),
    );
  }

  @check()
  @func()
  async testMocha(
    @argument({
      defaultPath: "/",
      ignore: [
        "*",
        "!examples/mocha",
        "examples/mocha/*/node_modules",
        "examples/mocha/*/*.md",
        "examples/mocha/*/.gitignore",
      ],
    })
    mochaExampleWorkspace: Directory,
  ): Promise<void> {
    const mochaDirectory = mochaExampleWorkspace.directory("examples/mocha");
    const examples = (await mochaDirectory.entries()).map((dir) =>
      trimSuffix(dir, "/"),
    );

    await Promise.all(
      examples.map(async (example) => {
        await getTracer().startActiveSpan(example, async () => {
          const ctr = dag
            .container()
            .from(NODE_CONTAINER_IMAGE)
            .withWorkdir("/src")
            .withMountedDirectory("/src", this.sourceCodeWorkspace)
            .withMountedDirectory(
              "/src/example",
              mochaDirectory.directory(example),
            )
            .withWorkdir("/src/example");

          await getTracer().startActiveSpan("latest version", async () => {
            await ctr
              .withExec(["npm", "install"])
              .withExec(["npm", "test"], {
                experimentalPrivilegedNesting: true,
              })
              .sync();
          });

          await getTracer().startActiveSpan("local version", async () => {
            await ctr
              .withExec([
                "npm",
                "pkg",
                "set",
                "devDependencies[@otel-test-runner/bun-test]=../packages/mocha-test",
              ])
              .withoutFile("package-lock.json")
              .withExec(["npm", "install"])
              .withExec(["npm", "test"], {
                experimentalPrivilegedNesting: true,
              })
              .sync();
          });
        });
      }),
    );
  }

  @func()
  async bump(
    @argument({
      defaultPath: "/",
      ignore: [
        "*",
        "!examples/",
        "examples/**/*/node_modules",
        "examples/**/*/*.md",
        "examples/**/*/.gitignore",
      ],
    })
    examplesWorkspace: Directory,

    version: string,
  ): Promise<Changeset> {
    let devContainer = dag
      .container()
      .from(BUN_CONTAINER_IMAGE)
      .withDirectory("/src", examplesWorkspace)
      .withWorkdir("/src");

    const testRunners = (
      await devContainer.directory("/src/examples").entries()
    ).map((testRunner) => trimSuffix(testRunner, "/"));

    for (const testRunner of testRunners) {
      const testRunnerExampleDirectory = devContainer.directory(
        `/src/examples/${testRunner}`,
      );
      const examples = (await testRunnerExampleDirectory.entries()).map(
        (example) => trimSuffix(example, "/"),
      );

      for (const example of examples) {
        await getTracer().startActiveSpan(
          `bump ${testRunner}/${example}`,
          async () => {
            devContainer = await devContainer
              .withWorkdir(`/src/examples/${testRunner}/${example}`)
              .withExec([
                "bun",
                "pm",
                "pkg",
                "set",
                `devDependencies[@otel-test-runner/${testRunner}-test]=${version}`,
              ])
              .sync();
          },
        );
      }
    }

    return dag
      .directory()
      .withDirectory("/", devContainer.directory("/src"))
      .changes(examplesWorkspace);
  }
}
