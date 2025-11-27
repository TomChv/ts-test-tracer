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

const WORKING_CONTAINER_IMAGE =
  "oven/bun:1.3-alpine@sha256:d2bc1fbc3afcd3d70afc2bb2544235bf559caae2a3084e9abed126e233797511";

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

    // Update dependency to be local so we can test the local code.
    this.sourceCodeWorkspace = dag
      .container()
      .from(WORKING_CONTAINER_IMAGE)
      .withDirectory("/src", sourceCodeWorkspace)
      .withWorkdir("/src/packages/bun-test")
      .withExec([
        "bun",
        "pm",
        "pkg",
        "set",
        "dependencies[@otel-test-runner/instrumentation]=../instrumentation",
      ])
      .withWorkdir("/src/packages/instrumentation")
      .withExec(["bun", "install"])
      .withWorkdir("/src/packages/bun-test")
      .withExec(["bun", "install"])
      .directory("/src");
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
      .from(WORKING_CONTAINER_IMAGE)
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
            .from(WORKING_CONTAINER_IMAGE)
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
      .from(WORKING_CONTAINER_IMAGE)
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
                `devDependencies[@otel-test-runner/bun-test]=${version}`,
              ])
              // Update lockfile
              .withExec(["bun", "install", "--lockfile-only"])
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
