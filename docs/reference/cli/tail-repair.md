# mnema tail repair

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

put back from git the lines of a public tail that do not read or whose hash does not hold, or the whole tail when its signed checkpoints do not hold

In the help under **This machine** · a command of [`mnema tail`](tail.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `tail` | the tail to repair, as `tail list` spells it: &lt;fingerprint>-&lt;installation> |

## Options

| Option | What it does |
| --- | --- |
| `--from <rev>` | the revision the lines or the tail are taken from (default HEAD): an older one, when the damage was committed |

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

It writes nothing else on that path. It adds, signs and deletes no line, leaves the last line when a crash cut it short, and
does not touch `checkpoints.jsonl`, `keys/` or `tailproof.json`; it joins no side of a conflict (a conflict marker in a segment is
refused: redo the merge with `mnema doctor --fix merge-driver` in place). It takes the tail's lock, so a write in progress is
waited out or refused and never interleaved with, writes each file through a temporary one and a rename, and keeps the segment as
it was in the repository's git directory, beside the lock (`<tail>.<segment>.<ms>.before-repair`), where it stays until you
delete it; a staging file a killed repair left there is removed by the next one. The repaired file is a change in your working
tree: `mnema verify` says whether the record holds, and committing the change is yours. When the lines are back and the tail's
signed checkpoints still do not hold, it says so: run the verb again, and it puts the whole tail back.

## Putting back a whole tail: when the signed checkpoints do not hold

Every line can read and hold its hash while the tail is still not as it was signed: someone rewrote an event and computed every
later link again, emptied or forged `checkpoints.jsonl`, or removed a signed event. Every write is refused over that, and the
read withholds what the checkpoints do not prove. When every line holds and the checkpoints do not, the same verb puts the whole
tail back:

```sh
mnema tail repair <tail>
#> Put back tail 8f21ab…-3c9d0e… from HEAD: 3 lines of 000001.jsonl; kept as they were in …/8f21ab…-3c9d0e….000001.jsonl.1763….before-repair.
#>   removed (nothing proves them): seq 1
#>   `mnema verify` says whether the record holds now; the files put back are a change in your working tree, yours to commit
```

The revision has to prove itself first: its events chain from seq 0 with every hash holding, and every line of its
`checkpoints.jsonl` holds, each signature checked under the key committed in `keys/` and bound to the fingerprint the tail is
named by; the tail's `tailproof.json` has to verify too. A revision that does not is refused, naming the file, the line and the
question it failed: name an older one with `--from`.

Above the revision, only what is proven is kept: an event the revision does not hold stays when a line of the working
`checkpoints.jsonl` that holds, folded on from the revision's last one, covers it, or when this machine's signed note (the one its
writer keeps beside the lock) vouches for it. Everything else is removed, and said by seq. A checkpoint signs the content and the
order of its events, not their links, so an honest event whose link somebody computed again is kept and its link computed again
onto the tail put back, which gives back the bytes it was written with; those seqs are said too. Where this machine signed the
tail further than what the revision and the working checkpoints prove, the repair is refused rather than drop signed work: name a
newer revision. The result is checked again before any byte is written.

The write is the line repair's: under the tail's lock, each file that changes kept first as it was beside the lock
(`checkpoints.jsonl` too), the segments put in place before `checkpoints.jsonl`, so a repair killed in between leaves checkpoints
that still do not hold and the next run finishes it. It still signs nothing and touches neither `keys/`, `tailproof.json`, the
notes beside the lock nor another tail.

Only the committed public tree is repaired. The project's private record and the machine's global one are not kept by git; a
line of either keeps the refusal it had (restore the file from a copy, or repair or remove the line by hand). The verb is not an
MCP tool: an agent that meets the refusal may suggest the command to the person.

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema tail repair [options] <tail>

put back from git the lines of a public tail that do not read or whose hash does
not hold, or the whole tail when its signed checkpoints do not hold

Arguments:
  tail          the tail to repair, as `tail list` spells it:
                <fingerprint>-<installation>

Options:
  --from <rev>  the revision the lines or the tail are taken from (default
                HEAD): an older one, when the damage was committed
  -h, --help    display help for command

A line is put back only when the revision holds it at the same place in the same file, it reads,
its hash is the one its content gives, and it chains to the line before it and, where one follows,
to the line after it (the last line of a tail has none). A last line that a crash cut short is left.

When every line holds and the tail’s signed checkpoints do not (events rewritten and re-chained,
`checkpoints.jsonl` emptied or forged, a signed event gone), the whole tail is put back: the
revision’s tail, which has to prove itself (its events chain from seq 0 and every checkpoint
signature holds under the committed key), and above it only the events a checkpoint that holds
or this machine’s signed note proves. Events nothing proves are removed; honest events whose
links were computed again by someone else get their links computed again as they were signed.

Nothing is signed, and `keys/`, `tailproof.json`, the notes beside the lock and every tree but the
committed public one are not touched. Each file as it was is kept in the repository’s git
directory, beside the tail’s lock, until you delete it, and the files put back are a change in
the working tree for you to commit. Only the public tree is repaired: it is the one git keeps.
```
