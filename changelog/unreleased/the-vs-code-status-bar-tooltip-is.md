Changed

- **The VS Code status bar tooltip is a verdict and one line per tree.** The block of `mnema verify` text it held, cut at six
  lines (the private tree's line was the one that fell out), is replaced by the `short` line `verify --json` carries for each tree (plain words; the `T1/T2/T4` terms stay in the console and behind the link),
  with the sentence about a newer mnema under its tree and the editor's error or info icon on a tree that is not clean. The long
  text is behind a link, the new command `mnema: Show Full Verification`, which runs `mnema verify --verbose` and `mnema switch`
  when it is clicked and shows them in an output channel. A reading no longer runs a second `mnema verify`.
