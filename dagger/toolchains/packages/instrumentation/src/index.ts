
import { dag, Container, Directory, object, func, argument } from "@dagger.io/dagger"

@object()
export class Instrumentation {
  originalWorkspace: Directory
  
  source: Directory
  
  constructor(
    @argument({
      defaultPath: "/",
      ignore: [
        "*",
        "!packages/instrumentation"
      ]
    })
    originalWorkspace: Directory,
  ) {}
}
