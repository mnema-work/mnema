Added

- **A public write whose text matches this machine's private list is refused, and `--allow-private-pattern` passes it.**
  A person keeps `private-patterns.txt` in the data directory (`~/.mnema`, or `$MNEMA_HOME`), one pattern per line: plain
  text, matched without regard to case, or `/regex/flags`; `#` starts a comment. Any text written to the PUBLIC tree that matches a pattern is refused with
  `PRIVATE_PATTERN`, naming the passage and the pattern, and nothing is recorded, not even the first half of a task and
  its description or a handoff and its brief: a decision, task, memory, observation, skill or handoff, the note or reason
  of a decision, task or skill move or a supersede (and `decision review`), a link, and `decision import --write`.
  `--allow-private-pattern` on those verbs (`allow_private_pattern` on the matching MCP tools) records it anyway. The
  private and global trees are never asked, and a machine with no list is not asked at all. A `decision import --write` is asked whole before its first event: if any file matches, nothing is recorded and
  the refusal names the file. A `/regex/` runs with a 50 ms limit per pattern and text; one that overruns, nests a
  quantifier or does not compile is read as the text between its slashes, and the refusal says so. The file is never in a
  repository and is never signed or recorded. `mnema record commit` warns, on the second stream and before it builds the
  branch, of each event it carries whose text matches the list; it still makes the branch. A retraction's reason and `unlink` are
  not asked: they take a fact out of effect, and a person withdrawing a leak must be able to say why. See [Recording decisions](docs/recording-decisions.md).
