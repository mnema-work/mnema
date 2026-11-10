# mnema tail prune

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

record that one whole tail was authorized to be cut (it removes nothing)

In the help under **This machine** · a command of [`mnema tail`](tail.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `tail` | the tail to cut, as `tail list` spells it: &lt;fingerprint>-&lt;installation> |

## Options

| Option | What it does |
| --- | --- |
| `--reason <text>` | why it is being cut (recorded in the fact) |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. It names the executor only: a waiver always follows the tail to the tree that holds it. |
| `--lose-keys <fingerprints>` | cut a tail that founded or enrolled keys the record still depends on, naming every one of them (comma-separated, whole): the refusal prints the list and the command. Those keys stop verifying or cannot write, and the cut's reason starts with them |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## Authorizing a cut, which is not the same as making one

Deleting a machine's tail from a record is invisible to the proof: `verify` reports
the same sentence a machine that never wrote anything gets. So a cut is **declared
before it happens**, while the tail is still on disk and everything the declaration
claims can be checked against it.

The declaration names a tail, and `tail list` is what spells one: with what it holds,
the tree the waiver will land in, and whether a cut of it is already authorized:

```sh
mnema tail list
#> 2 tail(s) holding events (the ones a cut can name):
#>   8f21ab…-3c9d0e…  public   41 event(s) through 5e4391d8…  the tail of mnid:60a50d38…  ·  no waiver
#>   4b90cd…-7ae112…  private  12 event(s) through 9c02f7a1…  the tail of mnid:c0fc3c71…  ·  no waiver
```

```sh
mnema tail prune 8f21ab…-3c9d0e… --reason "the person asked to be taken out"
#> Authorized the cut of tail 8f21ab…-3c9d0e…
#>   41 event(s) through 5e4391d8…, the tail of mnid:60a50d38…
#>   authorized by mnid:c0fc3c71…
#>   Landed in the public tree: committed with the repository, so it reaches every clone.
#>   The tail is still on disk at /path/to/repo/.mnema/tails/8f21ab…-3c9d0e…: nothing was removed.
#>   Git history, any remote and every clone still hold what that tail recorded: …
```

**It removes nothing, and that is the design.** Removing the directory is your act,
afterwards; this command records who authorized it, how many events were there and
the head they ran through, so `verify` can later name the account instead of listing
the three reasons a key might have no tail. It writes from **another** tail (a
waiver inside the tail being cut would be cut with it), so the tail it names is never
the one this machine writes to.

**Cutting the record's first tail keeps the record's name, when this command authorizes
the cut.** The name derives from the record's genesis tail (FORMAT.md section 6.10), and
the waiver is written before the cut on this machine's own tail, which names the record
from that genesis; every later write takes the name from it, and a branch made before the
cut merges into a record of one name, and both readers verify that merge where the writers
are keys of identities founded elsewhere than the cut tail, none that tail founded or enrolled
(`the-record-name-survives-a-cut-of-its-genesis.test.ts`). The cut keeps the name, not the identity:
the genesis founded one, so `tail prune` refuses to authorize cutting it unless `--lose-keys`
names the keys (below). Removing the genesis with no waiver, or with a waiver written
by mnema 0.1.4 (on a tail that names no record), leaves no tail carrying the name: the next
write names the record from the tails still there, and a branch that had named it from the
old genesis leaves two names once merged, which `verify` refuses (`another-record`).
`verify --since` refuses that branch before the merge.

**A tail that founded or enrolled a key is not cut without naming it.** An identity lives only
in the tail that wrote it, and the waiver carries none of it: cut the founder's tail of an
identity of two keys and the second key's events fail `verify` (T2/T4) in both readers and its
next write is refused (`STALE_ANCHOR`); cut the tail of a founder whose enrolled key never wrote
and `verify` stays green while that key is left without its identity. So `tail prune` refuses
(`KEYS_WOULD_BE_LOST`) a tail that introduces a key the record still depends on (one nothing revokes, or one
revoked that signed events in a tail that stays), names each key and says whether the cut **breaks** it (its
events stay in tails that stay) or only **strands** it, and prints the command:

```sh
mnema tail prune <tail> --reason "<why>" --lose-keys <fingerprint>[,<fingerprint>]
```

The command the refusal prints carries the reason you gave, quoted for a shell, so it runs as
printed.

`--lose-keys` takes the whole fingerprints, every one of them and no other (compared as a set, so a key named twice is one key, and refused on a tail that holds none), and the waiver's
reason then starts with `Keys lost:` and that list. The disk cannot say whether a key's machine
still exists, so a key not revoked counts. `tail list` marks the tails that hold such keys. The
tail of a key that was only enrolled holds none and is cut as before.

And it does **not** promise forgetting. Once the record is committed and pushed, the
events are in the git history, on the remote and in every clone; reaching those takes
`git filter-repo`, a force push and everyone re-cloning, which is outside what any
command here does. The output says so on the line where somebody would otherwise
assume it had been handled.

There is no MCP tool for this, deliberately: a cut is the one write whose consequence
is destructive, and it is authorized by a person at a shell or not at all.

**The tail that holds a relink is not cut while the tail it relinked is on disk.** Cut without
it, the relinked tail names the record it came from again, and `verify` refuses the directory as
two records; `tail prune` refuses (`RELINK_WOULD_BE_UNDONE`), naming the tail, unless the cut of
that tail is authorized first, by a waiver a checkpoint of its tail covers (`tail prune` signs its
waiver at once).

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema tail prune [options] <tail>

record that one whole tail was authorized to be cut (it removes nothing)

Arguments:
  tail                        the tail to cut, as `tail list` spells it:
                              <fingerprint>-<installation>

Options:
  --reason <text>             why it is being cut (recorded in the fact)
  --which <agent>             the agent that executed this, when an agent (a
                              script, a CI step) is driving mnema: omit it when
                              you are acting directly. It names the executor
                              only: a waiver always follows the tail to the tree
                              that holds it.
  --lose-keys <fingerprints>  cut a tail that founded or enrolled keys the
                              record still depends on, naming every one of them
                              (comma-separated, whole): the refusal prints the
                              list and the command. Those keys stop verifying or
                              cannot write, and the cut's reason starts with
                              them
  -h, --help                  display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
