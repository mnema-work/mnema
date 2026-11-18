# mnema tail repair

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

put back from git the lines of a public tail that do not read or whose hash does not hold

In the help under **This machine** · a command of [`mnema tail`](tail.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `tail` | the tail to repair, as `tail list` spells it: &lt;fingerprint>-&lt;installation> |

## Options

| Option | What it does |
| --- | --- |
| `--from <rev>` | the revision the lines are taken from (default HEAD): an older one, when the damage was committed |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## Putting back a line from git: `tail repair`

A line of the public record that no longer reads (a NUL where a byte was, a merge that left a fragment) or that reads and no
longer holds its hash (somebody edited its text) makes every write refuse, and the reads leave it out. The repository holds the
line as it was committed, and this is the one verb that puts it back:

```sh
mnema tail repair <tail>
#> Repaired tail 8f21ab…-3c9d0e…: 1 line(s) put back from HEAD.
#>   put back line 7 of 000001.jsonl (seq 6), which did not read, as HEAD holds it
```

For each line of the tail's segments that does not read or does not hold its hash, it takes the line at the same place in the
same file in the revision (`HEAD` unless `--from` names another), and puts it there only when that line reads, holds its hash,
and chains: its `prev` is the hash of the line before it as the file will be left, and, where a line follows, that line names
its hash as its `prev` (the last line of a tail has none, so it is checked on the side before alone). A line that fails any of these is not guessed at: nothing is written, and the refusal says which line and why. The
revision's line may itself be the damage somebody committed: name an older revision with `--from`. A line that is the same
bytes in the revision and does not read was written by a newer mnema: update mnema.

It writes nothing else. It adds, signs and deletes no line, leaves the last line when a crash cut it short, and does not touch
`checkpoints.jsonl`, `keys/` or `tailproof.json`; it joins no side of a conflict (a conflict marker in a segment is refused: redo
the merge with `mnema doctor --fix merge-driver` in place). It takes the tail's lock, so a write in progress is waited out or
refused and never interleaved with, writes each file through a temporary one and a rename, and keeps the segment as it was in
the repository's git directory, beside the lock (`<tail>.<segment>.<ms>.before-repair`), where it stays until you delete it; a
staging file a killed repair left there is removed by the next one. The repaired file is a change in your working tree: `mnema verify` says whether
the record holds, and committing the change is yours.

Only the committed public tree is repaired. The project's private record and the machine's global one are not kept by git; a
line of either keeps the refusal it had (restore the file from a copy, or repair or remove the line by hand). The verb is not an
MCP tool: an agent that meets the refusal may suggest the command to the person.

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema tail repair [options] <tail>

put back from git the lines of a public tail that do not read or whose hash does
not hold

Arguments:
  tail          the tail to repair, as `tail list` spells it:
                <fingerprint>-<installation>

Options:
  --from <rev>  the revision the lines are taken from (default HEAD): an older
                one, when the damage was committed
  -h, --help    display help for command

A line is put back only when the revision holds it at the same place in the same file, it reads,
its hash is the one its content gives, and it chains to the line before it and, where one follows,
to the line after it (the last line of a tail has none).
Nothing else is written: no line is added, signed or deleted, a last line that a crash cut short
is left, and `checkpoints.jsonl`, `keys/` and every tree but the committed public one are not touched. The
segment as it was is kept in the repository’s git directory, beside the tail’s lock, until you
delete it, and the
repaired file is a change in the working tree for you to commit. Only the public tree is
repaired: it is the one git keeps.
```
