import {
  dag,
  Container,
  Directory,
  object,
  func,
  argument,
  Secret,
  Changeset,
  BunTest,
  JestTest,
  MochaTest,
} from "@dagger.io/dagger";
import { getTracer } from "@dagger.io/dagger/telemetry";

@object()
export class Packages {
  originalWorkspace: Directory;

  constructor(
    @argument({
      defaultPath: "/",
      ignore: [
        "*",
        "!packages",
        "packages/**/node_modules",
        "packages/**/dist",
        "!examples",
        "examples/**/node_modules",
      ],
    })
    workspace: Directory,
  ) {
    this.originalWorkspace = workspace;
  }

  /**
   * Release all packages and return a changeset with the correct version bump.
   */
  @func()
  async release(
    npmToken: Secret,
    version: string,
    dryRun: boolean = false,
  ): Promise<Changeset> {
    let workspace = dag.directory();

    // First release the instrumentation package
    let instrumentationPkg = dag
      .instrumentation()
      .withBumpedVersion(version)
      .withUpdatedLockefile();

    await getTracer().startActiveSpan(
      "release instrumentation pkg",
      async () => {
        await instrumentationPkg.release(npmToken, { dryRun });

        workspace = await workspace
          .withDirectory("/", instrumentationPkg.changes().layer())
          .sync();
      },
    );

    // Sleep 3 seconds so the newly published lib can be downloaded.
    await Bun.sleep(3000);

    let packages: Record<string, BunTest | JestTest | MochaTest> = {
      bun: dag.bunTest(),
      jest: dag.jestTest(),
      mocha: dag.mochaTest(),
    };

    for (const name of Object.keys(packages)) {
      await getTracer().startActiveSpan(`release ${name}`, async () => {
        let _pkg = packages[name]
          .withBumpedVersion(version)
          .withUpdatedLockefile();

        await _pkg.release(npmToken, { dryRun });

        workspace = await workspace
          .withDirectory("/", _pkg.changes().layer())
          .sync();
      });
    }

    return workspace.changes(this.originalWorkspace);
  }
}
