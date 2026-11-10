# mnema tail relink

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

relink whole tails of another record into the one this directory names, each signed by its own key

In the help under **This machine** · a command of [`mnema tail`](tail.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `tails` | the tails to relink, as `tail list` spells them: &lt;fingerprint>-&lt;installation> |

## Options

| Option | What it does |
| --- | --- |
| `--into <record>` | the record they join, as `mnema verify` names it; omitted, the one other record the tails here name |
| `--reason <text>` | why they are relinked (recorded in the fact) |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. It names the executor only: a relink an agent key signs names the agent the record enrolled that key as |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## Joining a tail of another record: `tail relink`

Two `mnema init` on two branches, merged, leave a directory whose tails name two records, which
both readers refuse (`another-record`), and so does a private tree from before a repository that
named a record of its own. A tail is named by its own proof, signed at its birth, so nothing
written in the tail moves it; its owner moves it from another tail of the same key:

```sh
mnema tail relink <tail>... [--into <record>] --reason "<why>"
#> Relinked tail 8f21ab…-3c9d0e… into record 17bafa6742a2...
#>   5 event(s) through 828c7da8…, from record d461426489c0...
#>   written in tail 8f21ab…-ab6f53… at seq 5, signed by 8f21ab…, and checkpointed
#>   it brings 1 identity.founded, 1 key.enrolled and 1 decision(s)
```

Each relink is signed by the key the tail id names, which this machine must hold (yours, or an
agent's kept here), and written in this installation's tail of that key that names the record
joined, or, where this installation's tail names the other record, in a new tail born naming it;
it is checkpointed at once, since a relink above its tail's last checkpoint counts for nothing.
`--which <agent>` names the agent that executed the command, as `tail prune` takes it; a relink an
agent's key signs names the agent the record enrolled that key as, whatever is declared. `--into`
is the other record the directory names when it holds two (as `verify` prints it, the
first 12 characters are enough), and is asked for when it holds three or more. The relinked tail
is frozen at its head: a checkout whose own tail it was writes in a new tail from then on, here or
after it pulls the relink. The relink can be written before the merge or after it: bring the trunk
into the branch and relink there, and the pull request passes `verify --since` (and the Action)
where it was refused as `another-record`; or relink after the merge, and the pull request that
brings the relink passes. Either says the tail it moved (`(relinked)`, under `--since` above).

**Only the founder's keys relink.** The relink counts when its key holds a membership the record
joined gave it: the key that founded the identity of the record's genesis tail, or a key that
identity, or a member it took in, enrolled (ADR-157). A second person's tail of another record is
not relinked: that person writes again in the record, under a tail born in it, or the tail is cut.
An admission of another person's tail by a member of the record does not exist in this version.

Nothing is written where the readers would not count a relink: the command asks their rule first,
over the directory as it would read, and refuses by its words (`RELINK_WOULD_NOT_COUNT`, naming
`relink-not-a-member` and the rest). It asks their identity check (T2/T4) over that directory too,
and refuses `RELINK_WOULD_NOT_VERIFY`, naming the tail, the seq and their reason, where it would
refuse an event no tree refuses today: a relink does not change what a tail holds, so the record
would fail `verify`. A tail found in two trees is read from the first, and only what that version
refuses counts as refused today. Where the refused event is the relink itself, written in a new tail, the
message says a new tail of that key and names no id. It refuses too, each naming what it found, a tail that is not
here, whose key this machine does not hold (`NOT_THE_OWNER`), that names no record, that already
names the record it would join (`ALREADY_IN_THAT_RECORD`), that does not verify, that holds a
relink, or that a relink names already. It says, and does not refuse, what each tail brings into
the record: the identity facts it holds, how many decisions, and its first entry when it is older
than the record's genesis; and the records the directory still names after it, with the keys
whose owners must relink them, or whose tails are cut. A write into a directory of two records is
refused `STALE_ANCHOR` with words that name both records and this command: the anchor this
checkout records is not what is wrong there.

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema tail relink [options] <tails...>

relink whole tails of another record into the one this directory names, each
signed by its own key

Arguments:
  tails            the tails to relink, as `tail list` spells them:
                   <fingerprint>-<installation>

Options:
  --into <record>  the record they join, as `mnema verify` names it; omitted,
                   the one other record the tails here name
  --reason <text>  why they are relinked (recorded in the fact)
  --which <agent>  the agent that executed this, when an agent (a script, a CI
                   step) is driving mnema: omit it when you are acting directly.
                   It names the executor only: a relink an agent key signs names
                   the agent the record enrolled that key as
  -h, --help       display help for command

Each relink is signed by the key the tail id names, which this machine must hold, and
written in a tail of that key that names the record joined, or in a new one born naming it,
checkpointed at once. Only a key the record joined took in counts: the founder of its genesis
identity, or a key that identity enrolled. A relinked tail is frozen at its head.
Nothing is written where the readers would not count a relink.

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
