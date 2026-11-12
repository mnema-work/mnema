Added

- **A pull request is told what failed.** When CI is over for a pull request, one comment, rewritten after every run, names
  the checks that failed, the verdict of why-it-went-red, the failing tests with what each said, and for lint the exact
  `pnpm exec biome check --write <files>` command with the diff it applies; a first pull request is welcomed and pointed
  at CONTRIBUTING.md. CI's last job writes the report with its read-only token, and a separate `workflow_run` workflow,
  which checks out and runs nothing of the pull request, reads it as data and comments (`.github/what-failed/`).
