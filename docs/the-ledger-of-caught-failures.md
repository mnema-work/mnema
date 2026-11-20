# The ledger of caught failures

A few places in mnema catch a failure and go on, on purpose: a count that could not be written must not change the answer a tool
gives, and a hook that fails must not make somebody's session worse. Until now nobody could see those failures. `mnema doctor`
now reads a small file, on this machine, where a few of them leave one line each.

## What it keeps

One line, in `<data directory>/log/swallowed.jsonl` (`~/.mnema`, or `$MNEMA_HOME`), made of these and nothing else:

- the instant, in UTC to the second;
- the name of the place that caught the failure, one of a fixed list: `mcp.tool-call-count`, `tool-calls.append`,
  `hook.session-start`, `hook.session-recall`, `hook.after-a-write`, `hook.choice-settled`;
- the error's class name (`Error`, `SyntaxError`);
- the error's `code` when it has one (`EACCES`, `ENOSPC`, `ERR_MODULE_NOT_FOUND`, `SQLITE_BUSY`);
- the error's `syscall` when it has one (`open`, `mkdir`);
- the version of mnema. In a line a hook wrote it is the plugin's, read from its manifest, which is the number of the binary only
  where the two are of one release.

**It keeps no message.** An error's message is free text: it can carry a path in any shape, a package's name, or, from a database,
the statement and the record's content, so none of it is kept, not even redacted. Nor a stack, an argument, the content of a file,
the text a hook was handed, a decision's title, an id, the name of a project, a path or a person's words.

## Where it stays

It never leaves the machine: nothing reads it but `mnema doctor`, nothing sends it, and `mnema report` does not offer it. It is not
in the record and is not an event: nothing is signed, `mnema verify` never reads it and no format changed. It is not in the global
tree either, so a backup does not copy it. The file is mode `0600` in a directory `0700`. Where the machine has no key of its own
yet, nothing is written and no directory is made. Delete the file to start the count again. Switching reports off stops the reports and does not switch this ledger off: it is kept either way.

## How big it can get

A hard ceiling. When a new line would take the file past 128 KiB, the file is renamed over `swallowed.1.jsonl` and a new one
begins: at most 256 KiB in two files, and the older half is lost when it is renamed over, once, on purpose. The rename is done
holding a lock file (`swallowed.jsonl.lock`, made so that two processes cannot both hold it), so two processes cannot both rename
and lose the older half, and a line is not lost to the other's rename. A process that cannot get the lock within a third of a
second drops its line and leaves both files as they were; a lock a dead process left is taken over after 10 seconds. Within one
process a place, an error and a day write one line, and a process writes at most 50 lines, so a failure in a loop is a handful of
lines.

## What `mnema doctor` says

When the last 7 days hold lines, one finding: how many failures were caught, the newest, and the three places that did it most. It
says nothing on a machine where nothing was caught, and it says when the file is there and cannot be read (and then writes nothing
over it). It reads at most the last 256 KiB of each of the two files, so a file planted large is not read whole. It prints only the
instant of a line and the name of a place from the fixed list above: a line whose place is not on that list, or whose instant is not
in the shape written here, is counted as a line that did not read as the ledger's own and is never shown. It reads and writes
nothing else, as everywhere in `mnema doctor` asked alone.

## What is not in it yet

Only the places named above write to it: the MCP server's count of tool calls, the write of that count, and the outer catch of four
hooks (session start, session recall, after a write, choice settled). The other catch blocks that drop their error still do, and
they do not write here. A ledger that cannot be written is the one failure with no line behind it.
