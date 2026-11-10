# The decisions you already wrote

Your project probably decided things before it had a record, and wrote them down.
`mnema decision import` reads a directory of decision documents and **proposes** each
one. Nothing is accepted on your behalf: every proposal is born `proposed`, whatever
the file says its status is, and you rule on it with `decision move accept`, or one by one at a
terminal with `mnema decision review` (it asks for one note, then accept, reject, skip or quit for each
proposal, signs with your own key, and without a terminal writes nothing and prints the `move` command).
Accepting a decision that is already accepted changes nothing and is refused (`ILLEGAL_TRANSITION`) with the facts:
that it is already accepted, by a person or by which agent, and when.

Run it without `--write` first. Nothing is written, and the plan tells you what the
door made of every file:

```sh
mnema decision import docs/decisions
#> 3 proposal(s), 1 refused: nothing written. Add --write to record them.
```

A file whose decision the record already holds (an earlier run drew it from that file) is listed
as already in the record, unchanged. So is a file that says exactly the words of a decision
already recorded (a copy under another name, or two files in one run): nothing is written for
it, the line names the decision that holds those words, and no `derived-from` is drawn from
that file, since the decision was not born from it. Such a file is reported the same way on
every later run.

**Other places decisions are written** are read with `--format`, down the same road: planned
before written, every one born `proposed`, cited to where it was read, and the reason of each opens with
a line saying it was imported as written there and is not yet the project's own words.

| `--format` | `<source>` is | What is read |
| --- | --- | --- |
| `ecc-vault` | a directory of the ECC Memory Vault's `*.json` memories | `kind: "decision"` only; a `rejected` or `superseded` state is skipped |
| `rulings` | one ledger file | each line starting `Ruling:`, cited as `file:line` |
| `claude-memory` | a directory of the memory files Claude Code writes under `~/.claude/projects/<project>/memory/` | the `name:` frontmatter as the title, the body as the reason; `MEMORY.md` is skipped |

A source outside the project is cited as `<format>:<file>`, a name no clone can open. A file that
does not have its source's shape is named and nothing is read from it. A `rulings` origin
carries a line number, so a ledger edited above a line is read as new.

**The shape it reads is two things.** A level-1 title, and a why: the file's own decision
(the *Chosen option, because* sentence of a MADR `## Decision Outcome`, or the `## Decision`
of a Nygard record) when it has one; else a `## Context` section (`## Contexto` is read too)
or prose directly under the title. The context is the situation and not the reason, so a
file that states a decision is recorded with the decision. Everything else (the status, the
alternatives) is read when it is there and absent when it is not: a MADR `## Considered
Options` lists every option, the chosen one included, so it is recorded without the option
the file chose, and when the file does not say which it chose, none is recorded as turned
down and the plan says so. This is the smallest file that goes in:

```md
# Store timestamps in UTC

## Context

Three services send us times in three zones and the comparisons were wrong.
```

**What it will not read, and what it cannot tell.** A file with no title, or with no
prose it can read as a why, is refused BY NAME with the reason beside it: a rule like
`---` under the header is punctuation, not a reason, and is refused as one. But a file
this CAN read is proposed even when it is no decision: an index page, a roadmap and a
`DECISIONS.md` holding a hundred rows all have a title and prose under it, and no fact
of the document separates them from a decision. That is why nothing is accepted for
you, and why the dry run above is worth reading before you add `--write`.

## If your decisions are in one file

The door takes one decision per file, and it will not learn your table: a generic
table reader would still need you to declare which column is the title, which holds
the why, and which section of the file is history rather than agenda. Declaring all
that is writing the converter, in a worse language. So write the converter: it is
about thirty lines, it runs once, and what it produces is checked by the dry run
above.

<!-- BEGIN converter -->
```js
// convert-decisions.mjs: one decision document per row of a markdown table.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// EDIT THESE THREE. Nothing can work them out for you, which is the whole reason
// this is a script you own rather than a flag on a verb.
const SOURCE = 'DECISIONS.md'; // the file holding the table
const OUT = 'docs/decisions'; // where the one-per-file documents go
const COLUMN = { title: 1, rationale: 2 }; // which column is which, counting from 0

const cells = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
const says = (text) => /[\p{L}\p{N}]/u.test(text ?? '');

const rows = readFileSync(SOURCE, 'utf8')
  .split('\n')
  .filter((line) => line.trimStart().startsWith('|'))
  .map(cells)
  .filter((row) => !row.every((cell) => /^:?-+:?$/.test(cell))); // the separator row

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const row of rows.slice(1)) {
  // The first row is the header.
  const title = row[COLUMN.title];
  const rationale = row[COLUMN.rationale];
  // A row with no word in either cell is not a decision, and the import would refuse
  // it by name anyway: better to know that here, where you can look at the row.
  if (!says(title) || !says(rationale)) continue;
  n += 1;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const at = join(OUT, `${String(n).padStart(4, '0')}-${slug || 'decision'}.md`);
  writeFileSync(at, `# ${title}\n\n## Context\n\n${rationale}\n`);
}
console.log(`${n} document(s) in ${OUT}, from ${rows.length - 1} row(s) of ${SOURCE}`);
```
<!-- END converter -->

Then look at what it wrote, and let the dry run rule on it before anything is
recorded:

```sh
node convert-decisions.mjs
#> 111 document(s) in docs/decisions, from 118 row(s) of DECISIONS.md

mnema decision import docs/decisions
#> 111 proposal(s), 0 refused: nothing written. Add --write to record them.
```

**Read the refusals before you write.** A count of proposals with refusals beside it is
the only check there is that your column mapping was right: a table whose `rationale`
column is really a link column converts cleanly and proposes 111 decisions whose why is
a URL. The dry run cannot catch that. You can, by opening two of the files it wrote.
