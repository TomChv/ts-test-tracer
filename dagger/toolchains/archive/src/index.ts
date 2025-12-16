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
import { trimSuffix } from "./utils";

const WORKING_CONTAINER_IMAGE =
  "oven/bun:1.3-alpine@sha256:d2bc1fbc3afcd3d70afc2bb2544235bf559caae2a3084e9abed126e233797511";

@object()
export class Packages {
  originalPackageCodeWorkspace: Directory;

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
        "packages/*/dist",
        "*/.DS_Store"
      ],
    })
    packageCodeWorkspace: Directory,
  ) {
    this.originalPackageCodeWorkspace = packageCodeWorkspace;
    this.packageCodeWorkspace = packageCodeWorkspace;
  }

  /**
   * Return the list of packages of the project.
   */
  @func()
  async packages(): Promise<string[]> {
    return (
      await this.packageCodeWorkspace.directory("packages").entries()
    ).map((pkg) => trimSuffix(pkg, "/"));
  }

  @func()
  withFilteredPackage(include?: string[], exclude?: string[]): Packages {
    this.packageCodeWorkspace = this.originalPackageCodeWorkspace.filter({
      include: include?.map((pattern) => `packages/${pattern}`),
      exclude: exclude?.map((pattern) => `packages/${pattern}`),
    });

    return this;
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
      return ctr.withDirectory(".", this.packageCodeWorkspace, {
        include: ["**/*.ts", "**/tsconfig.json", "**/*.md"],
      });
    }

    for (const pkg of await this.packages()) {
      await getTracer().startActiveSpan(
        `install dependencies for pkg ${pkg}`,
        async () => {
          ctr = await ctr
            .withWorkdir(`/src/packages/${pkg}`)
            .withExec(["bun", "install", "--force"])
            .withDirectory(
              ".",
              this.packageCodeWorkspace.directory(`packages/${pkg}`),
              { include: ["**/*.ts", "tsconfig.json", "README.md"] },
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
   * Build the project with the current local version
   */
  @check()
  @func()
  async bunBuild(): Promise<void> {
    let devContainer = await this.devContainer(false);

    await getTracer().startActiveSpan(
      "build instrumentation package",
      async () => {
        devContainer = await devContainer
          .withWorkdir("packages/instrumentation")
          .withExec(["bun", "install"])
          .withExec(["bun", "run", "build"])
          .sync();
      },
    );

    const packages = await this.packages();
    await Promise.all(
      packages
        .filter((pkg) => pkg !== "instrumentation")
        .map(async (pkg) => {
          await getTracer().startActiveSpan(`build ${pkg} pkg`, async () => {
            await devContainer
              .withWorkdir(`packages/${pkg}`)
              .withExec([
                "bun",
                "pm",
                "pkg",
                "set",
                "@otel-test-runner/instrumentation=../instrumentation",
              ])
              .withExec(["bun", "install"])
              .withExec(["bun", "run", "build"])
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
    await this.release(dag.setSecret("npmToken", "x"), true);
  }

  /**
   * Release the packages to npm registry.
   */
  @func()
  async release(
    npmToken: Secret,

    dryRun: boolean = false,
  ): Promise<void> {
    const releaseCmd = ["bun", "publish", "--access-public"];
    if (dryRun) {
      releaseCmd.push("--dry-run");
    }
    const instrumentationPackage: Packages = new Packages(
      this.originalPackageCodeWorkspace,
    ).withFilteredPackage(["instrumentation"]);

    await getTracer().startActiveSpan(
      `release instrumentation pkg ${dryRun ? "(dry-run)" : ""}`,
      async () => {
        const instrumentationPackageDevContainer =
          await instrumentationPackage.devContainer(true);

        await instrumentationPackageDevContainer
          .withSecretVariable("NPM_CONFIG_TOKEN", npmToken)
          .withWorkdir(`packages/instrumentation`)
          .withExec(["bun", "run", "build"])
          .withExec(releaseCmd)
          .sync();
      },
    );

    const devContainer = await this.withFilteredPackage(
      [],
      ["instrumentation"],
    ).devContainer(true);
    const packages = await this.packages();

    await Promise.all(
      packages.map(async (pkg) => {
        await getTracer().startActiveSpan(
          `release ${pkg} ${dryRun ? "(dry-run)" : ""}`,
          async () => {
            await devContainer
              .withSecretVariable("NPM_CONFIG_TOKEN", npmToken)
              .withWorkdir(`packages/${pkg}`)
              .withExec(["bun", "run", "build"])
              .withExec(releaseCmd)
              .sync();
          },
        );
      }),
    );
  }

  @func()
  async updateLockfiles(): Promise<Changeset> {
    let devContainer = await this.devContainer();

    const originalWorkspace = devContainer.directory("/src");
    const packages = await this.packages();

    // Bump packages version
    for (const pkg of packages) {
      await getTracer().startActiveSpan(`update ${pkg} lockfiles`, async () => {
        devContainer = await devContainer
          .withWorkdir(`/src/packages/${pkg}`)
          .withExec(["bun", "install", "--lockfile-only"])
          .sync();
      });
    }

    return devContainer.directory("/src").changes(originalWorkspace);
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
    for (const pkg of packages.filter((pkg) => pkg !== "instrumentation")) {
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
            .sync();
        },
      );
    }

    return devContainer.directory("/src").changes(originalWorkspace);
  }
}
