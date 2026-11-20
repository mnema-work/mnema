Fixed

- **The after-a-write hook reads a Windows path.** `plugin/hooks/after-a-write.mjs` decided which writes can reach
  `mnema after-a-write` by patterns and by an "inside the project" check written with `/`, so on Windows a write to
  `C:\p\x.md` was never seen as inside `C:\p`, and a `.claude\rules\x` with no extension never matched. The path and the
  project directory are read with `\` as `/` for those checks; the payload still goes to the verb byte for byte.
