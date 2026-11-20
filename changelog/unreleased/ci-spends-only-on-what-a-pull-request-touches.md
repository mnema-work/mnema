Changed

- **CI pays only for what a pull request touches.** The host contract skips its jobs when no file the pull request changes is something it runs or reads, a pull request that changes only `docs/` and `changelog/` Markdown skips the test matrix (the guards always run), the build runs once and is shared by the test cells, and a Windows and macOS job cancelled with its runner is run once more by a workflow of its own.
