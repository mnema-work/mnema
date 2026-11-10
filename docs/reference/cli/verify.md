# mnema verify

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

verify this project's record: its committed tree and its private one

In the help under **Verify**.

## Options

| Option | What it does |
| --- | --- |
| `--global` | also cover this machine's global tree (left out by default): it belongs to no project and is present in every one, so a weakness in it would lower the verdict of every project on this disk |
| `--workspace <path...>` | verify the projects at these paths instead of this one, and give ONE verdict over all of them: the aggregate is the weakest, so no project passes on another's proof. The set is what you name and is never searched for: two names of one record count once, and a path holding no record is reported, left out of the level, counted at the end, and makes the exit non-zero unless --allow-no-record says otherwise. Costs one full replay per project |
| `--allow-no-record` | for --workspace: accept a named path that holds no record, and rule on the projects that do. Off by default, because naming a path is asserting that it is a project, so a mistyped path in a CI step is news rather than a silent pass. It tolerates ABSENCE and never a BREAK: a covered project that fails still exits non-zero |
| `--require <level>` | the least this invocation accepts, for a script or a CI step: chained (the default: fail only on a break, which is what a bare `verify` has always done), signed (also fail unless every event is covered by a verified signature: every write here signs what it wrote, so it passes whenever nothing is mid-write, and what it catches is checkpoints that did not verify or were taken out from under the events they signed, not a cut that took the newest events with their checkpoint), witnessed (also fail unless an external witness dates the record: `mnema witness stamp` asks for one, and it passes once a Bitcoin block carries it, never while it is pending) |
| `--since <rev>` | also fail unless the committed record is the one &lt;rev> held, grown at the end: every file it held under tails/ and keys/ is still here, and every segment and checkpoints.jsonl still begins with the bytes it held. Catches what no --require can: a cut that took events with their checkpoint, a record founded again, a rewrite signed again. Reads git, never the network, so &lt;rev> must be in this clone |
| `--against-github` | also compare the key each identity of this record signed with against the SSH keys the GitHub account it named (`mnema key github`) publishes at github.com/&lt;name>.keys. It proves the account publishes that key TODAY (not that it was the account’s when it signed), and it takes github.com’s word for it. Goes to the network only when given; what it finds is noted per identity and never moves the verdict or the exit |
| `--against-sigstore` | also read the Sigstore bundles `mnema witness sigstore` filed beside the checkpoints: who signed in to Sigstore to countersign each one, and when it was logged. Reads no network: it checks against the Sigstore trust root this binary carries. A bundle speaks for an identity of this record only where that identity named the same e-mail or workflow (`mnema key sigstore`). Noted per bundle; never moves the verdict, the level, `--require witnessed` or the exit |
| `--verbose` | also print what is informational and nothing else: the census notes about a backup key and about an agent named only by the key that signed, and the line for the private tree when it holds no record. A break, an issue, a warning and the exit are the same with and without it |
| `--json` | emit the verdict as JSON instead of prose: the whole reading, per tree, plus what NO --require value answers. The top "ok" is the verdict on the record, the same as "record.ok": false over a broken record, and false where no path covered a record. "requirementMet" says whether --require was reached. The exit code is unchanged: this changes the shape of the answer, never the answer |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema verify [options]

verify this project's record: its committed tree and its private one

Options:
  --global               also cover this machine's global tree (left out by
                         default): it belongs to no project and is present in
                         every one, so a weakness in it would lower the verdict
                         of every project on this disk
  --workspace <path...>  verify the projects at these paths instead of this one,
                         and give ONE verdict over all of them: the aggregate is
                         the weakest, so no project passes on another's proof.
                         The set is what you name and is never searched for: two
                         names of one record count once, and a path holding no
                         record is reported, left out of the level, counted at
                         the end, and makes the exit non-zero unless
                         --allow-no-record says otherwise. Costs one full replay
                         per project
  --allow-no-record      for --workspace: accept a named path that holds no
                         record, and rule on the projects that do. Off by
                         default, because naming a path is asserting that it is
                         a project, so a mistyped path in a CI step is news
                         rather than a silent pass. It tolerates ABSENCE and
                         never a BREAK: a covered project that fails still exits
                         non-zero
  --require <level>      the least this invocation accepts, for a script or a CI
                         step: chained (the default: fail only on a break, which
                         is what a bare `verify` has always done), signed (also
                         fail unless every event is covered by a verified
                         signature: every write here signs what it wrote, so it
                         passes whenever nothing is mid-write, and what it
                         catches is checkpoints that did not verify or were
                         taken out from under the events they signed, not a cut
                         that took the newest events with their checkpoint),
                         witnessed (also fail unless an external witness dates
                         the record: `mnema witness stamp` asks for one, and it
                         passes once a Bitcoin block carries it, never while it
                         is pending)
  --since <rev>          also fail unless the committed record is the one <rev>
                         held, grown at the end: every file it held under tails/
                         and keys/ is still here, and every segment and
                         checkpoints.jsonl still begins with the bytes it held.
                         Catches what no --require can: a cut that took events
                         with their checkpoint, a record founded again, a
                         rewrite signed again. Reads git, never the network, so
                         <rev> must be in this clone
  --against-github       also compare the key each identity of this record
                         signed with against the SSH keys the GitHub account it
                         named (`mnema key github`) publishes at
                         github.com/<name>.keys. It proves the account publishes
                         that key TODAY (not that it was the account’s when it
                         signed), and it takes github.com’s word for it. Goes to
                         the network only when given; what it finds is noted per
                         identity and never moves the verdict or the exit
  --against-sigstore     also read the Sigstore bundles `mnema witness sigstore`
                         filed beside the checkpoints: who signed in to Sigstore
                         to countersign each one, and when it was logged. Reads
                         no network: it checks against the Sigstore trust root
                         this binary carries. A bundle speaks for an identity of
                         this record only where that identity named the same
                         e-mail or workflow (`mnema key sigstore`). Noted per
                         bundle; never moves the verdict, the level, `--require
                         witnessed` or the exit
  --verbose              also print what is informational and nothing else: the
                         census notes about a backup key and about an agent
                         named only by the key that signed, and the line for the
                         private tree when it holds no record. A break, an
                         issue, a warning and the exit are the same with and
                         without it
  --json                 emit the verdict as JSON instead of prose: the whole
                         reading, per tree, plus what NO --require value
                         answers. The top "ok" is the verdict on the record, the
                         same as "record.ok": false over a broken record, and
                         false where no path covered a record. "requirementMet"
                         says whether --require was reached. The exit code is
                         unchanged: this changes the shape of the answer, never
                         the answer
  -h, --help             display help for command
```
