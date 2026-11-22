Changed

- **Small phrases and refusals say what to type instead, or what was left undone.**
  - `mnema brief --hook --host claude-code` (and `recall`) says Claude Code's own form is `--hook` without `--host`.
  - `mnema search synthetic load` says to quote several words as one term; `mnema task move <id> approve`, with the id
    before the action, says the action goes first (as `decision move` already did).
  - `--from` after `--to` is refused on `search`, `audit accountability` and `export` and on the `search` and
    `audit_accountability` tools (code `INVALID_WINDOW`), naming both ends; a window that holds nothing answers
    "Nothing recorded in this window." where `search` used to say "Nothing recorded here yet."
  - `mnema init` says git ignores `.mnema/` (and that no clone gets it) where it does, instead of "Commit `.mnema/`",
    and says a plain `git pull` was not set up where it was not asked for, with the two commands that cover it.
  - `mnema switch on <channel>` prints that channel's own effect, one sentence for each channel, where most printed
    "it hands the record over as it did before".
  - `mnema show <task> --full` prints every note about the task whole, with no cut at eight; plain `show` now says so
    under the list of notes.
  - A handoff whose brief is nothing but the path of a file under a temporary folder says, after recording it, that a
    reboot or a cleanup can clear the file (`mnema task handoff` and `record_handoff`). The handoff is recorded all the
    same, and a brief that is prose is not read for paths.
  - A decision of the private or the global tree is read as `ADR-<n> (private)` or `ADR-<n> (global)` in the opening
    text and in the compaction sentence, as it is everywhere else; the opening text used to say `private ADR-<n>`, and
    the compaction sentence labelled a decision with its tree only when another tree held the same number.
  - The tools no longer offer to address a decision at a path this connection looked at inside another agent's
    worktree (`.claude/worktrees/<name>/`), which is a copy of another branch.
