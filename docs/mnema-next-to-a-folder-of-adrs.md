# mnema next to a folder of ADRs

<!-- description: Keep your ADR files where they are and bring them into mnema as proposed decisions that are signed, can be superseded and can be addressed to code. -->

If your team already keeps its decisions as ADR files, they stay where they are. mnema does not move them, edit
them or ask you to stop writing them. What it adds is a record of the same decisions that is signed and checkable,
and that an agent is handed at the edit a decision governs.

## Bring the files in as proposals

`mnema decision import` reads a directory of decision documents (a level-1 title and named `##` sections: the Nygard
and MADR shape) and **proposes** each one. Run it first without `--write`: nothing is written, and the plan names what
the command made of every file.

```sh
mnema decision import docs/decisions
#> Read docs/decisions: 2 decision(s) to propose.
#>   proposed: Use Postgres for the orders database
#>       from docs/decisions/0001-use-postgres.md
#>   proposed: Write SQL by hand, no ORM
#>       from docs/decisions/0002-no-orm.md
#> Nothing was written. Run it again with --write to record these as proposals.
```

With `--write` each file is recorded as a decision born `proposed`, whatever status the file states: what the file
says is reported and never applied, so nothing is accepted on the team's behalf. Each one is cited to the file it was
read from. A file that is not a decision at all but wears the same shape (an index page, a roadmap) is proposed too,
and the team is the one that rejects it.

```sh
mnema decision import docs/decisions --write
mnema decision move accept ADR-<n> --note "Agreed in review."
```

In the second command, `ADR-<n>` is the label that `import` printed for the one you accept.

## What a decision becomes

Once the team has judged a proposal, it is a decision of the record like any other:

- **Signed.** It carries who recorded it and who accepted it, an agent or no agent declared, and `mnema verify` says whether
  anything in the record has been touched since.
- **Superseded, not lost.** A decision that replaces another is recorded and the earlier one is marked with the new
  one's id (`mnema decision supersede <old-id> <new-id> --reason "..."`); both stay in the record.
- **Addressed to the code it governs.** `mnema link ADR-<n> src/billing --rel governs` says which part of the code the
  decision is about. That address is how a rule reaches an agent at an edit it governs, on the hosts that do it
  ([Hosts](hosts.md)). A separate, stronger relation, `refuses-a-write`, makes the rule refuse a write there instead
  of only informing it.

## What it does not do

It does not check that the code follows a decision, and it does not say who a key belongs to: the record shows which
key signed, and an identity is not a person's name. Importing again is safe: a file whose
decision the record already holds is listed as already in the record, and nothing is written for it.

## Write the decisions back out as ADRs

`mnema export --madr <dir>` goes the other way: it writes each decision of the committed record as a MADR file in
`<dir>`, named `adr-<n>-<title>.md`.

```sh
mnema export --madr docs/decisions-from-mnema
```

Each file starts with frontmatter (`status`, `date`, the decision's id), the title, and a note that it is **derived**:
a reading of the signed record, not the source of truth. Change the decision in the record, never in the file.
The rationale is under `## Decision Outcome` and what was turned down is under `## Alternatives Considered`, written
as recorded. A decision that was superseded has `status: superseded by ADR-<n>` and names the other one in
`superseded-by` and `supersedes`. There is no `## Context and Problem Statement`: the record has one field for the
why, and the file does not invent a second.

It is a separate output from `mnema export` without the flag, whose feed carries the envelope and never a body.
The files carry the bodies, so the verb reads only the committed tree (the private and the global ones are left
out), and refuses a folder inside the record, a path that is a file, and a file in the folder that it did not write
(a hand-written ADR with the same name is never overwritten); a file it wrote itself is rewritten. It writes no
index page, because one would be read back as a decision.

`mnema decision import` of these files into another project gives the same title, rationale and alternatives, with
these limits:

- `import` skips a file whose status is retired (`superseded`, `rejected`, `deprecated`), so those decisions are
  exported but do not come back.
- What comes back is always `proposed`: an `accepted` decision is proposed again and someone accepts it here.
- `superseded-by` and `supersedes` are written for a reader and are not relinked by `import`.
- A decision that would not come back as the same words is named on standard error with each reason: a line of the
  text that starts with `##` (the reader cuts there), a `*` in the title (the reader removes it), or a space or break
  at the edge of the text (the reader trims it). The file is still written.

It also refuses to write through a symbolic link: if any file it would write is one, nothing is written. A folder
inside a `.git` folder, where the private tree of the record lives, is refused too. The folder you name may itself
be a link: that is yours to choose.
