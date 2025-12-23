import {
  dag,
  Container,
  Directory,
  Changeset,
  File,
  object,
  func,
  argument,
  check,
  Secret,
} from "@dagger.io/dagger";

const BUN_IMAGE =
  "oven/bun:1.3-alpine@sha256:d2bc1fbc3afcd3d70afc2bb2544235bf559caae2a3084e9abed126e233797511";

const REPO_PKG_LOCATION = "packages/instrumentation";
const MOD_PKG_LOCATION = `/src/${REPO_PKG_LOCATION}`;

@object()
export class Instrumentation {
  originalWorkspace: Directory;

  @func()
  source: Directory;

  constructor(
    @argument({
      defaultPath: "/",
      ignore: [
        "*",
        "!packages/instrumentation",
        "packages/instrumentation/node_modules",
        "packages/instrumentation/dist",
      ],
    })
    workspace: Directory,
  ) {
    this.originalWorkspace = workspace;
    this.source = workspace.directory(REPO_PKG_LOCATION);
  }

  /***********************
   * Dev Container
   ***********************/

  @func()
  devContainer(): Container {
    return dag
      .container()
      .from(BUN_IMAGE)
      .withWorkdir(MOD_PKG_LOCATION)
      .withDirectory(
        MOD_PKG_LOCATION,
        this.source.filter({ include: ["package.json", "bun.lock"] }),
      )
      .withExec(["bun", "install"])
      .withDirectory(
        MOD_PKG_LOCATION,
        this.source.filter({ exclude: ["package.json", "bun.lock"] }),
      );
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

  /***********************
   * Generate functions
   ***********************/
  @func()
  withBuild(): Instrumentation {
    this.source = this.devContainer()
      .withExec(["bun", "run", "build"])
      .directory(MOD_PKG_LOCATION);

    return this;
  }

  @func()
  withUpdatedLockefile(): Instrumentation {
    this.source = this.devContainer()
      .withExec(["bun", "install", "--lockfile-only"])
      .directory(MOD_PKG_LOCATION);

    return this;
  }

  @func()
  withBumpedVersion(version: string): Instrumentation {
    this.source = this.devContainer()
      .withExec(["bun", "pm", "pkg", "set", `version=${version}`])
      .directory(MOD_PKG_LOCATION);

    return this;
  }

  @func()
  changes(): Changeset {
    return dag
      .directory()
      .withDirectory(REPO_PKG_LOCATION, this.source)
      .changes(this.originalWorkspace);
  }

  /***********************
   * Release functions
   ***********************/
  @func()
  async release(npmToken: Secret, dryRun: boolean = false): Promise<void> {
    const releaseCmd = ["bun", "publish", "--access", "public"];
    if (dryRun) {
      releaseCmd.push("--dry-run");
    }

    await this.devContainer()
      .withSecretVariable("NPM_CONFIG_TOKEN", npmToken)
      .withExec(releaseCmd)
      .sync();
  }
}
