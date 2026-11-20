# The ledger of caught failures

A few places in mnema catch a failure and go on, on purpose: a count that could not be written must not change the answer a tool
gives, and a hook that fails must not make somebody's session worse. Until now nobody could see those failures. `mnema doctor`
now reads a small file, on this machine, where a few of them leave one line each.

## What it keeps

One line, in `<data directory>/log/swallowed.jsonl` (`~/.mnema`, or `$MNEMA_HOME`):

- the instant, in UTC to the second;
- the name of the place that caught the failure (`mcp.tool-call-count`, `tool-calls.append`, `hook.session-start`,
  `hook.session-recall`, `hook.after-a-write`, `hook.choice-settled`): a name that stays when the code is moved, not a file and a line;
- the error's class name, and its `code` when it has one (`EACCES`, `ENOSPC`, `ERR_MODULE_NOT_FOUND`);
- the first line of the error's message, only when the error has a code of its own, which makes it a failure of the system and its
  words the system's words, with every absolute path in it that is not under the data directory replaced by `<path>`;
- the version of mnema.

An error with no code (a `SyntaxError` quotes the text it could not parse) keeps its class name and nothing else.

## What it never keeps

A stack, an argument, the content of a file, the text of a hook's input, a decision's title, an id, the name of a project, a
person's words, a path outside the data directory.

## Where it stays

It never leaves the machine: nothing reads it but `mnema doctor`, nothing sends it, and `mnema report` does not offer it. It is not
in the record and is not an event: nothing is signed, `mnema verify` never reads it and no format changed. It is not in the global
tree either, so a backup does not copy it. The file is mode `0600` in a directory `0700`. Where the machine has no key of its own
yet, nothing is written and no directory is made. Delete the file to start the count again.

## How big it can get

A hard ceiling. When a new line would take the file past 128 KiB, the file is renamed over `swallowed.1.jsonl` and a new one begins:
at most 256 KiB in two files, and the older half is lost when it is renamed over. Within one process a place, an error and a day
write one line, and a process writes at most 50 lines, so a failure in a loop is a handful of lines. Two processes at once can
both write the same line: nothing locks the file.

## What `mnema doctor` says

When the last 7 days hold lines, one finding: how many failures were caught, the newest, and the three places that did it most. It
says nothing on a machine where nothing was caught, and it says when the file is there and cannot be read (and then writes nothing
over it). It reads and writes nothing else, as everywhere in `mnema doctor` asked alone.

## What is not in it yet

Only the places named above write to it: the MCP server's count of tool calls, the write of that count, and the outer catch of four
hooks (session start, session recall, after a write, choice settled). The other catch blocks that drop their error still do, and
they do not write here. A ledger that cannot be written is the one failure with no line behind it.
