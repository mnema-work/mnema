Added

- **A public write whose text matches this machine's private list is refused, and `--allow-private-pattern` passes it.**
  A person keeps `private-patterns.txt` in the data directory (`~/.mnema`, or `$MNEMA_HOME`), one pattern per line: plain
  text, matched without regard to case, or `/regex/flags`; `#` starts a comment. A decision, a task, a memory, an
  observation, a skill or a handoff written to the PUBLIC tree whose text matches a pattern is refused with
  `PRIVATE_PATTERN`, naming the passage and the pattern, and nothing is recorded. `--allow-private-pattern` on those verbs
  (`allow_private_pattern` on `record_decision`, `create_task`, `capture_memory`, `record_observation`, `create_skill`
  and `record_handoff`) records it anyway. The private and global trees are never asked, and a machine with no list is
  not asked at all. The file is never in a repository and is never signed or recorded. `mnema record commit` warns, on
  the second stream and before it builds the branch, of each event it carries whose text matches the list; it still makes
  the branch. The other writes (a move's reason, a link, a check) are not asked. See
  [Recording decisions](docs/recording-decisions.md).
