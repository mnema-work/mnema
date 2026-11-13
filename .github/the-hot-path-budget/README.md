# The hot path budget

Two things run on every session of every project that has the plugin: the commands that hand the
session the record as it opens, and the call that hands it the rules of a file before each edit.
They run whether or not anybody asked, so what they cost is paid on every edit and on every session,
and a record that grows makes them slower. This measures them every week, on records of 1,000 and of
3,000 decisions, and opens an issue when they are over the budget.

It is **not a gate**. It blocks no merge, it is not a required check, and it must never be added to
branch protection: an issue is the signal.

## What is measured

The commands are read from [`plugin/hooks/hooks.json`](../../plugin/hooks/hooks.json), so a hook that
changes is a hook that is measured, and a hooks file that loses one makes the measurer refuse:

| Name in the table | Command read from the hooks file |
|---|---|
| before an edit | the gate of the PreToolUse group for `Write\|Edit\|NotebookEdit` that runs for Qwen Code (`--host qwen`) |
| session start, the document | `session-start.mjs`, which runs `mnema brief` |
| session start, the notes | `session-recall.mjs`, which runs `mnema recall` |

Claude Code reaches the same function as the edit gate through a call into the server it already
runs, which is not a process the hook starts. The command measured is the one a host whose hooks
are processes pays at every edit: the same read of the same record, plus the start of a process.

Each command is started as a process (`sh -c`, as the host runs it) with an empty environment but a
home of its own, a PATH and what the hook needs. Each size and command is measured **warm**
(the cache the command line keeps in the tree is there) and **cold** (that file is deleted before
the run, which is a clone's first read), five runs each, and the median is what counts.

## The records

[`generate.mjs`](generate.mjs) writes them with the product's own writer, in a directory under the
machine's temporary folder with a home of its own, and refuses any other place. The shape is a
function of the index of the decision, so two runs write the same record up to the ids and the
clock:

- every decision is recorded and accepted;
- one in five governs a directory, which is the proportion of the record the fix for the
  replaced-rule lookup was measured on (600 rules over 3,003 decisions), and there is one directory
  per fifty decisions, so a path meets ten rules at every size: what grows is the record;
- one in ten replaces the decision recorded just before it, so describing a rule has a replaced
  decision to name.

The record of 1,000 decisions is the first part of the one of 3,000. Writing them is the slow part
of a run: 6,899 writes took 167 s on the runner the first measurement was taken on, and the whole
job 4 minutes.

## The budget

[`budget.json`](budget.json) holds the numbers, and [`verdict.mjs`](verdict.mjs) reads them. Two
sentences, and nothing else judges:

1. For every command and for cold and warm alike, the median on 3,000 decisions is at most **3.0**
   times the median on 1,000. The records differ threefold, so 3.0 is the most that linear growth
   allows. A command that reads the whole table once per rule, which is what the read before an edit
   did until the lookup of replaced rules went through an index, is far above it.
2. For every cell, the median is at most **1.5** times the median of the first measurement, which
   is written in `first` of the file for that cell.

A cell the file carries no number for is a failure, not a pass.

## What runs, and what it does

[`../workflows/hot-path-budget.yml`](../workflows/hot-path-budget.yml) runs on Mondays and by hand.
A pull request that changes the instrument (this folder's scripts or the workflow, not its pages)
runs it once and opens no issue. Over the budget, one issue is opened under the title *The hot path
is over its budget*, or the open one gets a comment with the table. The table is in the summary of
every run.

## Reading a result

The table has, for each size, command and cache state, the median, the range of the five runs, and
the first measurement. A green run is within the budget **as measured on one shared runner**: a
runner that is slower than the one the first measurement was taken on reads as a regression. Read
the ranges before reading the verdict, and run it again before believing a single over.

The first measurement is the median of the first run on a runner (a GitHub-hosted `ubuntu-24.04`, on a pull request, with the
record of 1,000 and of 3,000 decisions written in 167 s), and the number is written once.
It is not moved to make a run pass: when the hot path is made faster on purpose the numbers are
lowered, and when it is made slower on purpose the change says so and why.

## Running it by hand

Only in a sandbox, and never with the real home. After `pnpm build`:

```
env -i HOME="$(mktemp -d)" PATH="$PATH" GIT_CONFIG_NOSYSTEM=1 \
  node .github/the-hot-path-budget/measure.mjs scan --runs 3 --out reading.json
```

`--sizes 250,500` measures smaller records for a look; the numbers of `budget.json` are for the
sizes it names.
