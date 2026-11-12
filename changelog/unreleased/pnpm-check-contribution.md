Added

- **`pnpm check:contribution` is the check before a pull request.** It runs lint, build, typecheck, the guards and only the
  tests tied to the files the branch changed against its merge base with `origin/main`, with one worker and a 30 s test
  timeout, and says at the end that CI runs the whole suite. It asks for `git fetch origin main` when that ref is missing.
  A `.devcontainer/devcontainer.json` gives the toolchain: Node at the floor, pnpm through corepack, `python3`.
