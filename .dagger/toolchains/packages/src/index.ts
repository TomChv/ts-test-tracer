/**
 * A toolchain to manage packages
 */

import {
  dag,
  Container,
  Directory,
  File,
  object,
  func,
  argument,
  check,
  Changeset,
  Secret,
} from "@dagger.io/dagger";
import { getTracer } from "../sdk/core";

const WORKING_CONTAINER_IMAGE =
  "oven/bun:1.3-alpine@sha256:d2bc1fbc3afcd3d70afc2bb2544235bf559caae2a3084e9abed126e233797511";

@object()
export class Packages {
  @func()
  packageCodeWorkspace: Directory;

  constructor(
    @argument({
      defaultPath: "/",
      ignore: [
        "*",
        "!packages/*",
        "packages/biome.json",
        "packages/*/node_modules",
        "packages/*/assets",
        "packages/*/.gitignore",
        "packages/*/*.md",
      ],
    })
    packageCodeWorkspace: Directory,
  ) {
    this.packageCodeWorkspace = packageCodeWorkspace;
  }

  /**
   * Return the list of packages of the project.
   */
  @func()
  async packages(): Promise<string[]> {
    return this.packageCodeWorkspace.directory("packages").entries();
  }

  /**
   * Return a dev container containing the packages.
   */
  @func()
  async devContainer(install: boolean = false): Promise<Container> {
    let ctr = dag
      .container()
      .from(WORKING_CONTAINER_IMAGE)
      .withWorkdir("/src")
      .withDirectory("/src", this.packageCodeWorkspace, {
        include: ["**/package.json", "**/bun.lock"],
      });

    if (!install) {
      return ctr;
    }

    for (const pkg of await this.packages()) {
      await getTracer().startActiveSpan(
        `install dependencies for pkg ${pkg}`,
        async () => {
          ctr = await ctr
            .withWorkdir(`/src/packages/${pkg}`)
            .withExec(["bun", "install"])
            .withDirectory(
              ".",
              this.packageCodeWorkspace.directory(`packages/${pkg}`),
              { include: ["*.ts", "tsconfig.json"] },
            )
            .sync();
        },
      );
    }

    return ctr.withWorkdir("/src");
  }

  /**
   * Run biome check (linter) on packages.
   */
  @check()
  @func()
  async biomeCheck(
    /**
     * biome.json configuration file for linter
     */
    @argument({ defaultPath: "/packages/biome.json" })
    biomeJSON: File,
  ): Promise<void> {
    const devContainer = await this.devContainer(true);
    const packages = await this.packages();

    await Promise.all(
      packages.map(async (pkg) => {
        await getTracer().startActiveSpan(`lint ${pkg}`, async () => {
          await devContainer
            .withWorkdir(`packages/${pkg}`)
            .withMountedFile("biome.json", biomeJSON)
            .withExec(["bunx", "biome", "check"])
            .sync();
        });
      }),
    );
  }

  /**
   * Operate a dry-run release on all packages
   */
  @check()
  @func()
  async releaseDryRun(): Promise<void> {
    const devContainer = await this.devContainer(false);
    const packages = await this.packages();

    await Promise.all(
      packages.map(async (pkg) => {
        await getTracer().startActiveSpan(
          `release dry-run ${pkg}`,
          async () => {
            await devContainer
              .withEnvVariable("NPM_CONFIG_TOKEN", "x")
              .withWorkdir(`packages/${pkg}`)
              .withExec(["bun", "publish", "--access-public", "--dry-run"])
              .sync();
          },
        );
      }),
    );
  }

  /**
   * Release the packages to npm registry.
   */
  @func()
  async release(npmToken: Secret): Promise<void> {
    const devContainer = await this.devContainer(false);
    const packages = await this.packages();

    await Promise.all(
      packages.map(async (pkg) => {
        await getTracer().startActiveSpan(`release ${pkg}`, async () => {
          await devContainer
            .withSecretVariable("NPM_CONFIG_TOKEN", npmToken)
            .withWorkdir(`packages/${pkg}`)
            .withExec(["bun", "publish", "--access-public"])
            .sync();
        });
      }),
    );
  }

  /**
   * Bump packages to the given version.
   *
   * - Update `version` in `package.json`
   * - Update `@otel-test-runner/instrumentation` to the given version.
   */
  @func()
  async bump(version: string): Promise<Changeset> {
    let devContainer = await this.devContainer();

    const originalWorkspace = devContainer.directory("/src");
    const packages = await this.packages();

    // Bump packages version
    for (const pkg of packages) {
      await getTracer().startActiveSpan(
        `bump ${pkg} to ${version}`,
        async () => {
          devContainer = await devContainer
            .withWorkdir(`/src/packages/${pkg}`)
            .withExec(["bun", "pm", "pkg", "set", `version=${version}`])
            .sync();
        },
      );
    }

    // Bump `@otel-test-runner/instrumentation` version in tests runner
    // support.
    for (const pkg of packages.filter((pkg) => pkg !== "instrumentation/")) {
      await getTracer().startActiveSpan(
        `bump @otel-test-runner/instrumentation in ${pkg} to ${version}`,
        async () => {
          devContainer = await devContainer
            .withWorkdir(`/src/packages/${pkg}`)
            .withExec([
              "bun",
              "pm",
              "pkg",
              "set",
              `dependencies[@otel-test-runner/instrumentation]=${version}`,
            ])
            // Update lockfile
            .withExec(["bun", "install", "--lockfile-only"])
            .sync();
        },
      );
    }

    return devContainer.directory("/src").changes(originalWorkspace);
  }
}
