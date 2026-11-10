# mnema witness

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

ask an outside witness to date this record, and read where that stands

In the help under **Verify**.

## Options

| Option | What it does |
| --- | --- |
| `--global` | also cover this machine's global tree (left out by default): it belongs to no project and is present in every one, and a witness over a tree no verdict reads is work with no reader (default: false) |
| `--json` | emit where the proof stands as JSON instead of prose: one entry per tail, with the reading as the verifier derived it |

## Commands

| Command | What it does |
| --- | --- |
| [`mnema witness stamp`](witness-stamp.md) | ask an outside witness to date each tail's last checkpoint (T3) |
| [`mnema witness upgrade`](witness-upgrade.md) | go back for every attestation this record is waiting on (T3) |
| [`mnema witness sigstore`](witness-sigstore.md) | countersign each tail's last checkpoint with a Sigstore certificate: who signed in, and when it was logged |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## Asking somebody outside to date the record

The two local layers catch an edit that breaks the hash chain and an edit made
without the signing key. Neither catches the person who **holds** the key, rebuilds
the whole record from nothing and re-signs it: everything links, everything verifies,
and the chain claims a history it acquired this morning. What that person cannot
produce is an attestation dated before they started.

```sh
mnema witness stamp
#> 8f21ab…-3c9d0e… (public): stamped: asked an outside witness to date checkpoint f84396…
#>   external witness (T3): pending: an attestation was requested from
#>   https://alice.btc.calendar.opentimestamps.org and has not confirmed
```

What leaves this machine is the **SHA-256 of one checkpoint's signed message** and
nothing else (no id, no title, no body, no count) and each calendar is handed a
hash of that digest with a nonce of its own, so no two of them see the same value.
One checkpoint is enough for the whole record: checkpoints chain, so an attestation
over the last one dates every checkpoint below it. Stamps are never removed and the
reading asks the newest one there is, so a record stamped in March and written to in
April still reports March: with the count of events written since, because a date
that does not say what it reaches claims more than it holds. A request that has **not
confirmed yet** survives the same way: `verify` names it and names the calendar it is
with, whichever checkpoint it was filed under, so *nobody asked* and *somebody asked
and we are waiting* are never the same sentence. The window is ordinary (the two
attestations in this repository's own fixture were asked for at 00:52 and served
complete at 12:49), and the act that follows from reading silence is to stamp again.

The answer is a **promise, not a proof**. It becomes one when a Bitcoin block carries
it, minutes to hours later, and until then `verify` says `PENDING`, which is not
coverage. `mnema witness upgrade` is the return visit: safe to repeat, and it fetches
the 80-byte block header the proof lands in so that every verification after it is
arithmetic on this machine.

It goes back for **every** request the tail still has open, not only the newest one, and
that is not a refinement: a proof stays under the checkpoint it was filed under while the
head moves on every write, so by the time a calendar has an answer the request is usually
somewhere else entirely. Asking only about the head meant this verb answered
`nothing has been asked about this checkpoint yet` about records `verify` was reporting a
request in flight for: the same product contradicting itself about the same disk. It
walks newest first and stops at the first attestation that confirms, because a proof below
one that confirmed dates less of the record at a later instant, and no reading would ever
quote it:

```sh
mnema witness upgrade
#> 8f21ab…-3c9d0e… (public): completed: the attestation over checkpoint f84396… has confirmed
#>   external witness (T3): covered: Bitcoin block 963688 at 2026-08-23T06:03:01.000Z

mnema verify --require=witnessed
#> public: local integrity verified (T1/T2/T4) and witnessed (T3); 1 tail(s); all events are
#> signature-covered; external witness (T3): covered, Bitcoin block 963688 at 2026-08-23T06:03:01.000Z
#> (the work of its block header was checked here, not its place in the Bitcoin chain)
```

**What `covered` checked offline is said in the verdict itself**: the block header did
the work it declares and the proof folds to it. Whether that header is in the Bitcoin
chain is not asked here (that needs a node or an explorer), so `--require=witnessed`
passing means the attestation is arithmetic that closes, not that a block was looked up.

A checkpoint normally has **several** confirmed attestations: three calendars land in
three blocks, and this record's proof reaches 963688, 963689 and 963690. The one a verdict
quotes is the **lowest block**, which is the rule `chain/FORMAT.md` §8 names. It used to be
the first attestation a walk of the proof reached that had a header, which meant the date
this product published depended on the order a third party serialized an `.ots` file in,
and over this very record the reference verifier in `chain/verifier/` read 06:03:01 while
the product read 06:23:18, twenty minutes apart from the same bytes. By **height** and not
by instant: a block's `nTime` is declared by whoever mined it and consensus only bounds it,
so a lower block may carry a later one.

**The address a return visit goes back to is checked before it is asked.** Every open
request names the calendar that took it, and that name was written by whoever answered:
into a file a project can be handed. So the verb goes only to an https address at a
public timestamp operator, follows a redirect only while it stays on the same host, and
reports anything else by name without contacting it, in a line of its own: *was not
asked by this machine*, which is a different fact from *did not answer* and calls for a
different response. By operator domain and not by exact host, so a proof taken by a
calendar nobody has heard of yet still completes.

`verify` **never touches a network** to read the witness (the one flag that reaches one
is `--against-github`, and only when it is given). It reads the proof and the header out of the
record, checks that the proof commits to the checkpoint it proved, that the path folds
to the merkle root the header carries, and that the header did the work it declares.
The proof itself is [OpenTimestamps](https://opentimestamps.org)' own file, unaltered,
so a stranger with the `ots` client and no copy of mnema gets the same answer from the
same bytes.

**It is opt-in, and nothing on the writing path asks anybody for anything.** A record
nobody stamps behaves byte for byte as it did before this existed, and a checkpoint
can never fail because a calendar was unreachable. What the layer does **not** prove:
that the block header sits on the longest chain (a reader who needs that follows the
block id into any explorer) and it says nothing at all about deletion or about whose
key really signed.

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema witness [options] [command]

ask an outside witness to date this record, and read where that stands

Options:
  --global            also cover this machine's global tree (left out by
                      default): it belongs to no project and is present in every
                      one, and a witness over a tree no verdict reads is work
                      with no reader (default: false)
  --json              emit where the proof stands as JSON instead of prose: one
                      entry per tail, with the reading as the verifier derived
                      it
  -h, --help          display help for command

Commands:
  stamp [options]     ask an outside witness to date each tail's last checkpoint
                      (T3)
  upgrade [options]   go back for every attestation this record is waiting on
                      (T3)
  sigstore [options]  countersign each tail's last checkpoint with a Sigstore
                      certificate: who signed in, and when it was logged
```
