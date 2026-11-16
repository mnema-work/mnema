Changed

- **The marketplace lists both plugins from the `release` branch, and `mnema doctor` says whether the installed plugin's files are the released ones.**
  The branch is moved to each release's tag by the release workflow, with a deploy key only that job can read, and by a push that
  is refused unless it is a fast-forward; the entries of `.claude-plugin/marketplace.json` are now of the `git-subdir` form with
  `ref: release`. A plugin installed from the folder of `main` is updated with the commands in
  [Install](docs/install.md#if-you-already-had-the-marketplace), measured on Claude Code, Codex and Copilot CLI. `doctor` hashes the
  folder Claude Code installed the plugin in (a line ending is not a difference) against the digest the build wrote into the binary,
  and says "the ones released with this binary" or "the label but other content"; it says nothing where the binary is not the
  bundle. A copy of `plugin/opencode/mnema.js` and the Gemini and Qwen checkouts in the Hosts page are now of a release tag, not `main`.
