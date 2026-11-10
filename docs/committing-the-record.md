# Committing the record through a pull request

Cutting the record onto a branch, being told what no commit holds yet, and pulling a record that grew on another machine.

## Committing the record through a pull request

A writer appends to a tail and commits nothing, so the record's events reach git when somebody
commits `.mnema/`. `record commit` makes that commit for a pull request of its own, without
touching your working tree, your index or the branch you are on.

```sh
# Cut each tail at its last signed checkpoint onto a new branch, and print what to run next.
mnema record commit

# Only as far as the checkpoint that covers one decision's recording, in its tail.
mnema record commit --through ADR-12 --json
```

The base is the branch the remote calls its default, as this clone last read it: the remote is the
one the current branch follows, else the only one, else `origin`, and the default branch is the one
`refs/remotes/<remote>/HEAD` names. It reads nothing from the network: where that ref is missing it
refuses and says to run `git remote set-head <remote> --auto`, and it says how long ago the base was
last updated, with `git remote update <remote>` to read it again. Every tail file the base holds must
be the start of the one here, or it refuses, naming the file, and points at `record pull`.

Each tail is cut through its last signed checkpoint; with `--through`, the tail that records that
decision is cut through the first checkpoint that covers the recording, and the other tails through
their last. The cut never goes below what the base holds, and it does not look at a decision's state:
a proposed decision is committed, and reads as proposed. The commit carries the segments and
checkpoints cut there, a new tail's proof and each key file a line of the cut names; nothing of
the private tree. Where the base holds none of the files `mnema init` writes beside the record
(`.gitattributes`, `.gitignore`, `README.md`, `.editorconfig`), they go in too, so the first commit
of a record carries `* -text` and the tails' merge line. The events above the cut stay out and are
counted; a file of `.mnema/` the base already holds stays as the base has it, except the `README.md`
and the `.editorconfig` when yours are exactly the text this mnema writes for them (a write replaces
an older page with the current one): those go in. Every other file that differs from the base (an
`inherit.json`, a README you edited, say) stays out, each named as left out: commit those with git.

It builds the commit with git's plumbing on top of the base, signed when `commit.gpgSign` is set, as
`git commit` would sign it. Before a branch exists, the tree is checked out apart and verified at the
signed level and with `--since` the base; where either fails it refuses and makes no branch. Then it
prints `git push -u <remote> <branch>` and the command that opens the pull request: `gh pr create`
for a GitHub remote, `glab mr create` for a GitLab one, a sentence for any other. A remote reached over
ssh whose host is not a known forge may be an alias of your ssh configuration: the host is read with
`ssh -G <alias>` (three seconds at most, nothing is connected to), and the sentence stays where ssh is
absent or does not answer. It pushes nothing
and runs neither. The branch is `mnema-record/` with the decisions' labels and a digest of where
the cut ends: run again with nothing new it says the branch is there, and once the base holds the cut
it says there is nothing to commit. After the pull request merges, `record pull` brings the branch
followed back over the events that stayed out.

## Being told what no commit holds yet

Nothing commits the events a writer appends, so `mnema status`, `mnema doctor` and the end of a
session say what is still in none. The count is, per tail of the project's committed tree, the
complete lines of each segment file here above the lines of the same file in `HEAD`; a tail git does
not track at all counts whole. It reads no network and writes nothing, and it asks git for the size of each
tail file in `HEAD` and for the content only of a file whose size differs. What is only staged is not
counted as held: the question is what a commit already carries.

```sh
mnema status        # a "Not in git yet:" section; `--json` adds an `eventsNotInGit` key
mnema doctor        # "to do · record-in-git: ..."
```

The sentence reads:

> 3 events of this record are not in a git commit yet (the oldest was written 3 hours ago): `mnema record commit` prepares them as a branch for a pull request and prints the commands to run next; it pushes nothing.

It names the command and does not ask for it: the person, or the agent
the person asked, runs what `record commit` prints. The age is the oldest waiting event's own time, and
it is marked old past 24 hours: `(the oldest was written 2 days ago, which is old: past 24 hours)`;
that limit is fixed, not a setting. Where the default branch (the one `record commit` takes as its base,
as this clone last read it) has had commits since the last one that changed `.mnema/`, the sentence says
how many, counting only the first parent so a merged pull request is one; and where the branch the
current one follows holds commits that changed the record and this clone lacks, it adds that
`mnema record pull` brings them over the events waiting here.

In a partial clone it never fetches an object to answer: a tail file of `HEAD` the clone does not hold makes the count unknown and nothing is said, and a commit count git cannot read from the clone is left out of the sentence.

It says nothing when no event waits, outside a git repository, with no project record, and where git
ignores the record's tails (a record you ignore is not one you are told to commit). With
`mnema switch off session-tally` the closing line is silent, and `status` and `doctor` still say it;
the closing line comes after a response that wrote a file, as that line always has. `status --json` carries the
key only while something waits, and its value is `events`, `tails`, `oldestAt`, `oldestHours`, `old`,
`defaultBranch`, `commitsSinceRecordCommit` and `pullDue`.

## Pulling a record that grew here

A tail only grows, and a writer appends to it without committing. A pull request carries those
events to the branch you follow, which then holds the start of your local file, and `git pull`
refuses ("Your local changes ... would be overwritten by merge") before any merge runs, although
nothing would be lost.

```sh
# git pull over the record's uncommitted events, when the branch followed holds their start.
mnema record pull

# Make a plain `git pull` carry the record in this clone: the tails' merge driver, merge.autoStash
# and rebase.autoStash, with the driver's name (four settings, written in that order, in .git/config).
mnema doctor --fix merge-driver --dry-run
mnema doctor --fix merge-driver
```

`record pull` refuses, writing nothing, when a file outside `.mnema/` has changes (commit or stash
them first), and when a tail file here and on the branch followed is not one the start of the other,
byte for byte: that is a fork, and it names each file and the line where the two sides part. Then it
runs `git pull --autostash` with the merge driver given on that one command line, puts back a file
of the record git did not track yet (a tail opened here) when this checkout's side is the longer,
and verifies the record. It writes no git configuration. It fails, printing what git said, when the
pull fails (branches that diverged with no `pull.rebase` set, say) and when git puts its autostash
back with conflicts: a file of the record that is not a tail, `.gitattributes` for one, merges as
text, and git then keeps the stash; it names the files and leaves the rest to you.

**The merge driver.** `mnema init` writes `tails/*/*.jsonl merge=mnema-tail` into the record's
`.gitattributes`: a tail's segments and checkpoints merge through `mnema record merge-tail`, which
keeps the longer side when one is the start of the other, and on a fork keeps your side byte for byte,
says it is a fork and where the sides part, and leaves the file conflicted. It never joins the two:
a file holding both sides is a fork, which both readers refuse. Git runs a driver only where its own
configuration says what the name means, and a committed file cannot say it, so a clone merges the
tails as text, as git merges any file, until a person runs `mnema doctor --fix merge-driver`; `mnema
doctor` names a clone where it is missing; on Windows it finds the earlier form `mnema` as `mnema.cmd`
or any other extension `PATHEXT` lists.

**A plain `git pull`.** No driver makes a plain `git pull` pass over uncommitted changes: git refuses
those before it merges, whatever the configuration says about merges. What makes it automatic is git's
autostash, which stashes the events, pulls, and puts them back through the driver. `mnema doctor --fix
merge-driver`, and the answer to the question `mnema init` asks in a repository with a remote (`--git-pull
yes`, or `--yes`, which takes the default, yes), write four settings into this clone's `.git/config`,
the driver first, then the autoStash ones: the driver's name, the driver, `merge.autoStash` (read by a merge pull: `git pull`, `git pull
--no-rebase`) and `rebase.autoStash` (read by `git pull --rebase`, which refuses without it). They are never
written one without the driver: an autoStash alone leaves git exiting 0 over conflict markers inside signed
tails, which `mnema verify` then refuses. Measured on git 2.55, with the clone's own configuration and no
`mnema` on the `PATH`, `git pull`, `git pull --no-rebase`, `git pull --rebase` and a merge or a rebase beside
an unrelated local commit all succeed over local events that are the start of the branch's or longer than it,
and the record verifies afterwards (`packages/code/tests/a-plain-git-pull-carries-the-record.test.ts`).
**The autostash settings apply to every file of the clone**, not only the record: a pull stashes and restores
any file with uncommitted changes, and the question, the plan and the fix say so. A setting of the same name
that you set otherwise (`merge.autoStash=false`) is left where it is, and then none of the four is written. This is not
a rollback: if git fails to write one, the ones after it are not written and the ones before it stay, which is why the
driver goes first. No autoStash is written while the driver cannot run here.
The driver is named by the node and the script of the installation that ran the fix, by absolute path, so a
git started by a program with no `mnema` on its `PATH` (an editor opened from a launcher) still finds it; an
installation that moves (another node
version, a reinstalled folder) leaves a driver git cannot start, and with an autoStash on a plain pull then exits 0
with the local events only in the stash. So `mnema doctor` and `mnema status` say when the driver cannot run (its node
or script is gone, or, for the earlier form that ran `mnema` by the `PATH`, there is no `mnema` on it) while an autoStash
is on, and `mnema doctor --fix merge-driver` replaces a driver of mnema's that cannot run with one that does, and only
then writes the autoStash settings; it keeps a driver that runs. `mnema doctor` says what is missing.

**A fork that git hides.** When both sides appended to the same tail, a plain `git pull` with these
settings exits 0, says "Fast-forward", leaves the tail files in conflict, and keeps the local side only in
git's stash, where git itself suggests a `git stash drop`. `mnema status` ("Kept aside by a pull") and `mnema
doctor` say so, in one sentence, whenever the stash holds an autostash with tail files or a tail file is in
conflict in the index: do not drop the stash, it may hold the only copy of those events (`git stash show -p`
prints them). `mnema record pull`, run before the pull, names such a fork and writes nothing; once a plain
pull has left it aside, `record pull` refuses until the conflict is settled, and does not look in the stash.
