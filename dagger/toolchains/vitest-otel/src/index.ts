import {
  dag,
  Container,
  Directory,
  object,
  func,
  argument,
  check,
  Changeset,
  Secret,
} from "@dagger.io/dagger";
import { getTracer } from "@dagger.io/dagger/telemetry";

const NODE_IMAGE =
  "node:24.11.1-alpine3.22@sha256:2867d550cf9d8bb50059a0fff528741f11a84d985c732e60e19e8e75c7239c43";
const BUN_IMAGE =
  "oven/bun:1.3-alpine@sha256:d2bc1fbc3afcd3d70afc2bb2544235bf559caae2a3084e9abed126e233797511";

const REPO_PKG_LOCATION = "packages/vitest-otel";
const MOD_PKG_LOCATION = `/src/${REPO_PKG_LOCATION}`;
const REPO_EXAMPLE_LOCATION = "examples/vitest";
const MOD_EXAMPLE_LOCATION = `/src/${REPO_EXAMPLE_LOCATION}`;
const MOD_INST_PKG_LOCATION = "/src/packages/instrumentation";

@object()
export class VitestOtel {
  originalWorkspace: Directory;

  source: Directory;

  examples: Directory;

  local: boolean;

  constructor(
    @argument({
      defaultPath: "/",
      ignore: [
        "*",
        "!packages/vitest-otel",
        "packages/vitest-otel/node_modules",
        "packages/vitest-otel/dist",
        "!examples/vitest",
        "examples/vitest/**/node_modules",
        "examples/vitest/**/*.md",
        "**/*.DS_Store"
      ],
    })
    workspace: Directory,

    /**
     * Set to true to install instrumentation package as a local
     * dependency.
     */
    localPkg: boolean = false,
  ) {
    this.originalWorkspace = workspace;
    this.source = workspace.directory(REPO_PKG_LOCATION);
    this.examples = workspace.directory(REPO_EXAMPLE_LOCATION);
    this.local = localPkg;
  }

  /***********************
   * Dev Container
   ***********************/

  @func()
  devContainer(): Container {
    let ctr = dag
      .container()
      .from(BUN_IMAGE)
      .withWorkdir(MOD_PKG_LOCATION)
      .withDirectory(
        MOD_PKG_LOCATION,
        this.source.filter({ include: ["package.json", "bun.lock"] }),
      );

    if (this.local) {
      ctr = ctr
        .withDirectory(
          MOD_INST_PKG_LOCATION,
          dag.instrumentation().withBuild().source(),
        )
        .withExec([
          "bun",
          "pm",
          "pkg",
          "set",
          "@otel-test-runner/instrumentation=../instrumentation",
        ]);
    }

    return ctr.withExec(["bun", "install", "--force"]).withDirectory(
      MOD_PKG_LOCATION,
      this.source.filter({
        exclude: ["package.json", "bun.lock", "node_modules"],
      }),
    );
  }

  @func()
  exampleContainer(): Container {
    return dag
      .container()
      .from(NODE_IMAGE)
      .withMountedDirectory(
        "/src/packages",
        this.devContainer().directory("/src/packages"),
      )
      .withWorkdir(MOD_EXAMPLE_LOCATION)
      .withDirectory(MOD_EXAMPLE_LOCATION, this.examples);
  }

  /***********************
   * Checks functions
   ***********************/

  /**
   * Execute biomeCheck
   */
  @check()
  @func()
  async biomeCheck(
    @argument({
      defaultPath: "/packages/biome.json",
    })
    biomeConfig: File,
  ): Promise<void> {
    await this.devContainer()
      .withMountedFile("biome.json", biomeConfig)
      .withExec(["bun", "run", "lint"])
      .sync();
  }

  @check()
  @func()
  async verifyBuild(): Promise<void> {
    await this.withBuild().source.sync();
  }

  @check()
  @func()
  async releaseDryRun(): Promise<void> {
    await this.withBuild().release(
      dag.setSecret("NPM_CONFIG_TOKEN", "x"),
      true,
    );
  }

  @check()
  @func()
  async runExample(): Promise<void> {
    const exampleDirs = (await this.examples.entries()).map((dir) =>
      trimSuffix(dir, "/"),
    );
    const testContainer = this.withBuild().exampleContainer();

    await Promise.all(
      exampleDirs.map(async (example) => {
        await getTracer().startActiveSpan(example, async () => {
          let _testContainer = testContainer.withWorkdir(example);

          if (this.local) {
            _testContainer = _testContainer
              .withExec([
                "npm",
                "pkg",
                "set",
                "devDependencies[@otel-test-runner/vitest-otel]=../../../packages/vitest-otel",
              ])
              .withoutFile("package-lock.json");
          }

          await _testContainer
            .withExec(["npm", "install"])
            .withExec(["npm", "test"], {
              experimentalPrivilegedNesting: true,
            })
            .sync();
        });
      }),
    );
  }

  @check()
  @func()
  async runLocalExample(): Promise<void> {
    this.local = true;

    await this.runExample();
  }

  /***********************
   * Generate functions
   ***********************/
  @func()
  withBuild(): VitestOtel {
    this.source = this.devContainer()
      .withExec(["bun", "run", "build"])
      .directory(MOD_PKG_LOCATION);

    return this;
  }

  @func()
  withUpdatedLockefile(): VitestOtel {
    this.source = this.devContainer()
      .withExec(["bun", "install", "--lockfile-only"])
      .directory(MOD_PKG_LOCATION);

    return this;
  }

  @func()
  async withBumpedVersion(version: string): Promise<VitestOtel> {
    this.source = this.devContainer()
      .withExec(["bun", "pm", "pkg", "set", `version=${version}`])
      .withExec([
        "bun",
        "pm",
        "pkg",
        "set",
        `dependencies[@otel-test-runner/instrumentation]=${version}`,
      ])
      .directory(MOD_PKG_LOCATION);

    let exampleCtr = this.exampleContainer();
    const exampleDirs = (await this.examples.entries()).map((dir) =>
      trimSuffix(dir, "/"),
    );

    for (const exampleDir of exampleDirs) {
      exampleCtr = exampleCtr
        .withWorkdir(`${MOD_EXAMPLE_LOCATION}/${exampleDir}`)
        .withExec([
          "npm",
          "pkg",
          "set",
          `dependencies[@otel-test-runner/vitest-otel]=${version}`,
        ]);
    }

    this.examples = exampleCtr.directory(MOD_EXAMPLE_LOCATION);

    return this;
  }

  @func()
  changes(): Changeset {
    return dag
      .directory()
      .withDirectory(REPO_PKG_LOCATION, this.source)
      .withDirectory(REPO_EXAMPLE_LOCATION, this.examples)
      .changes(this.originalWorkspace);
  }

  /***********************
   * Release functions
   ***********************/
  @func()
  async release(npmToken: Secret, dryRun: boolean = false): Promise<void> {
    const releaseCmd = ["bun", "publish", "--access-public"];
    if (dryRun) {
      releaseCmd.push("--dry-run");
    }

    await this.devContainer()
      .withSecretVariable("NPM_CONFIG_TOKEN", npmToken)
      .withExec(releaseCmd)
      .sync();
  }
}

function trimSuffix(str: string, suffix: string) {
  return str.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
}
