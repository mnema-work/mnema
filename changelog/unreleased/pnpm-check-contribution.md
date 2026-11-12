Added

- **`pnpm check:contribution` is the check before a pull request.** It runs lint, build, typecheck, the guards and only the
  tests tied to the files the branch changed against its merge base with `upstream/main` (or `origin/main`, or the ref in
  `MNEMA_BASE`), with one worker and a 30 s test timeout, and says at the end that CI runs the whole suite. Because
  `--changed` stops at a package's built `dist`, a change under `packages/<name>/src` also runs every test of the packages
  that import it, and a change to the Python reader runs its `self-test` and `vectors`. It says what to fetch when the base
  is missing, and `--plan` prints the steps without running them. A `.devcontainer/devcontainer.json` gives the toolchain:
  Node at the floor, pnpm through corepack, `python3`.
