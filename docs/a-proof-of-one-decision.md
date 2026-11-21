# A proof of one decision

<!-- description: Hand one decision to somebody as one file they check offline, without the repository, and what that file proves and does not. -->

A record proves itself to whoever holds the repository. `mnema prove` proves ONE decision to whoever
receives one file: a reviewer, an auditor, a page that quotes it. They check it offline, with this
product or with the second reader beside the format, which imports nothing of it.

```sh
mnema prove ADR-12 --out adr-12.proof.json
mnema prove --check adr-12.proof.json
```

`mnema prove` takes the decision's id or its `ADR-` label, finds it in the committed record, verifies
that record first, and writes the file to standard output or to `--out` (an existing file is never
replaced). It says what the file holds on the other stream. `--check` reads nothing but the file.

Without mnema, from a clone of this repository:

`python3 packages/chain/verifier/mnema_verify.py proof adr-12.proof.json`

## What is in the file

Nothing in it is signed anew. It carries bytes the record already holds and already signs
([`FORMAT.md`](../packages/chain/FORMAT.md) section 9 has them byte by byte):

- every signed range (a checkpoint and every line it signs) that holds a writing or a move of the
  decision, and the birth of any decision that superseded it;
- the roster facts of every identity those lines speak for (its founding, the keys and agent keys it
  enrolled, revoked or retired), each in its own signed range, so the file shows that the key that
  signed was the identity's at that point;
- the tail proof of each tail it draws from, and the public keys;
- a manifest: the decision's title, rationale, alternatives and label, its moves with who made each
  and where its line is, its state, and the record the tails name.

A range is carried whole, because a checkpoint's signature covers every line of its range, and on each
tail the file carries every range from the first it needs to the last, with no gap: nothing between
two lines it carries (a move, a writing, a revoked key) can be left out. So the lines beside the
decision's travel with it, and the file grows with the distance between them: a decision recorded far
down the tail that also holds its identity's founding carries that tail from the founding on. Measured
over all 641 decisions of this repository's own record (two tails, 2.9 MB): from 9 KB to 1.1 MB, half
of them under 12 KB and one in ten above 700 KB, the large ones being the decisions written on the
tail that holds the founding.

## What it proves

That these keys signed these lines at these places of the record; that the record had made each key
valid for the identity it signed for; and that those lines read as this decision, with this text, these
moves and this state. A checker derives the manifest from the signed lines and refuses the file when
one field differs: change one word of a line, or of the manifest, and both checkers refuse it.

## What it does not prove

Both checkers print this beside every proof they accept.

- **That nothing came after it.** On each tail it carries, a proof covers every line from the first it
  carries to the last, and nothing after. A supersede, a
  rejection, a new writing or a revoked key written later is not in it, and the file cannot say there
  was none. To know the decision is still in force, read the record itself, or ask for a newer proof.
- **That no other tail holds something.** The record is the set of its tails, one per machine, and the
  file carries the ones the decision needed. A move written on another machine and not read by the one
  that wrote the rest is not in it.
- **When.** Every time in it is the clock of the machine that wrote it. No external witness travels
  with a proof; `mnema witness` dates the record itself.
- **Who held the key.** It proves which key signed, and that the record enrolled that key for that
  identity, not which person or program held it.

A decision of this machine's private tree is refused unless `--private` asks for it: no clone carries
that tree, and the file hands its lines, and the lines beside them in the same ranges, to whoever
receives it.

See also: [What it proves](what-it-proves.md), [Checking a record without installing this](verify-without-installing.md),
and [the `prove` command](reference/cli/prove.md).
