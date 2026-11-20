# mnema audit antipatterns

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show recurring shapes in the record (reopens, supersessions, deprecations)

In the help under **Read** · a command of [`mnema audit`](audit.md).

## Options

| Option | What it does |
| --- | --- |
| `--json` | emit the faithful shapes with their evidence as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

Beside the shapes, the page reads what agents accepted, in three signals. It is a reading, never a pause: nothing is
refused, written or switched off, and no number has a threshold; the person decides whether to run
`mnema switch off agent-accepts`. Who accepted or superseded is the `which` on the event: an event with none is "no
agent declared", which is not proof that a person did it, since an agent that ran the command without `--which` leaves
the same mark.

- **Rules taken out of force by an agent.** A decision accepted by an event that declares no agent, or one that carries an
  address (`governs`, `asks-for-a-person`, `refuses-a-write`), and then superseded by an event that declares one. A
  decision superseded by an event that declares none is not counted.
- **Chains of three decisions or more.** A replaced by B, B by C, each id in order. The chain follows the first supersede
  of each decision and does not look at the state it left (`from`), so a proposal replaced and then a decision replaced
  count the same.
- **Accepts that quote no words of the person.** Two totals, kept apart: the accepts that declare an agent, and the accepts
  that declare none (not read as a person's), each with how many hold no words of the person. A note has them when it holds
  a passage between double quotes (straight, curly or Portuguese) of at least 20 characters, case and spacing folded, that
  is not pure assent ("yes", "sim, pode", "ok", "go ahead" and the like): the same definition the accept gate applies.
  Single quotes, "chosen by", "dictated by" and "the maintainer said" do not count. The reading judges by the form of the
  note only: the passage is not checked against the conversation here (the gate checks it at accept time), so a note that
  cites the person falsely passes, and one that paraphrases honestly is counted.

The text lists at most 10 ids per signal and then says how many more there are; `--json` carries the same three under
`agentAccepts` in full, with the `at` each event claims. The command line's reading only:
the agent's `audit_antipatterns` tool does not carry it.
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema audit antipatterns [options]

show recurring shapes in the record (reopens, supersessions, deprecations)

Options:
  --json      emit the faithful shapes with their evidence as JSON
  -h, --help  display help for command
```
