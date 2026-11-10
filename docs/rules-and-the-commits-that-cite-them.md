# Rules that govern a path, and the commits that cite them

A rule that names the program that checks it, and the verbs that read the git log against the record.

## A rule that carries its check

A decision in force can name the program that checks it, and a machine of its own can record, at a
commit, whether the rule held.

```sh
# A person declares the check. The program and its arguments, one by one: there is no shell, so
# nothing in them is split, globbed or expanded; an argument that starts with a dash goes after `--`
# (`mnema check declare <decision-id> node -- -e "process.exit(0)"`).
mnema check declare <decision-id> node scripts/check-cents.js

# On the machine that will run checks (a CI runner), once: a key of its own, for ONE identity.
mnema key request --checker --anchor <identity>
# A member of that identity enrolls the line it printed, and commits the vouch.
mnema key enroll --checker <the line>

# On the runner, at a clean commit: run the check of every rule in force and record each result.
mnema check run --key <the checker's private key file>
```

The key file has to hold an Ed25519 key, like an agent's: any other kind is refused (`UNREADABLE_KEY`) before anything runs.
A key holds one role: `key enroll --checker` refuses a member's key (`A_MEMBER_KEY`) and an agent's, in use or retired (`AN_AGENT_KEY`).

`check run` starts each declared program from the project root with this process's environment, minus every
`MNEMA_*` variable (that narrows what the program is handed, not what it can read from disk),
stops it after `--timeout` seconds (300 by default) and records it as failed. It writes one
`check.passed` or `check.failed` per rule, naming the rule and the commit `HEAD` names, with the end
of what the program printed (at most 4000 characters, control bytes made visible, credentials
redacted). It exits non-zero when any check failed. It refuses a tree that has changes outside the
record or is not at a commit, because a result names a commit. The results are written to the
working tree, where the caller commits them; nothing here pushes.

**The key can say that a check passed, and nothing else.** A checker key is enrolled by a member
of an identity, and a key that is already a member of one is refused. `mnema verify` refuses a
`check.passed` or `check.failed` signed by any other key, and refuses any other fact signed by a
checker key, so a leaked runner secret cannot decide a rule or write a note. `mnema audit accountability`
lists the checker as a machine, apart from the people.

**A leaked key is retired.** Any member of an identity can take the role away, as any member can
grant it; the key is not asked:

```sh
mnema key revoke --checker <fingerprint> --reason "<why>"
```

Commit and push the retirement, and enroll a new key for the runner. From the retirement on, `mnema
verify` refuses a result the old key signs, any other fact it signs, and an enrolment of it again;
`check run` refuses to run with it. The results it signed before still verify, because the key held
the role when it signed them, and `verify` names them in its census
(`census [retired-checker] …`): a leaked key can date a result before its own
retirement, so the record no longer vouches for them. `mnema audit accountability` says who retired it.

What it does not promise: a result says that a key your team enrolled reported the rule held at that
commit. It does not say the program ran as it was declared on that machine, and it does not say
the program checks what its rule says. A declared program runs on the runner, so whoever can commit
a declaration can make the runner start that program. The Action in `packages/action` runs the
step above for you when it is handed the checker key as a secret (`checker-key`), and leaves the
results in the working tree for your workflow to commit or upload.

## Reading the git log against the record

A commit carries the change and the record carries the reasoning; a trailer in the commit's
message is the line between them, and four verbs read it (a fifth, `commit-hook`, is below). They run `git log` when asked, take no
lock and write nothing: not a pointer to a commit, not a count.

```sh
# The line to put in a commit message. It carries the label, or `--id` for the id, which names
# the decision in whichever clone it is read.
git commit --trailer "$(mnema trailer ADR-4)"

# The commits that cite a decision, and, as a second list, the commits that touched a path it
# addresses.
mnema commits ADR-4

# Under which decisions a file stands, or a commit: the rules in force that address it, each
# saying what it does there (governs, refuses a write, asks for a person), and the commits that
# touched it and carry a trailer. A rule the project inherits is listed too, naming its origin.
mnema why src/billing/invoice.ts
# With `edit-rules-push` switched off, `rules` and `why` add, on the second stream, that
# the rules governing the path are not handed to an agent when it edits there.

# Accepted decisions whose addressed paths changed in many commits since they were accepted.
mnema aging --min-commits 10
```

**What it proves.** That a commit's message carries the trailer, and that a commit touched a path
a decision addresses: facts git holds and anyone can re-run with `git log`. **What it does not.**
A trailer is a claim its author made, signed by nobody: it does not say the commit follows the
decision, and the record does not know the commit exists. A commit that touched a path says only
that the change landed where the decision speaks, and the two lists are kept apart for that
reason. `why` answers with the rules in force today, not the ones that were when the commit was
made. A clone that holds part of the history says so, and answers from what it holds; a commit
rewritten away takes its trailer with it, and the record does not keep a copy. `aging` counts one
number (commits since the acceptance that touched an address of the decision, 20 or more unless
`--min-commits` says otherwise) and it points, it does not conclude: a decision about a file
edited every day because the decision is being followed is listed too. Only accepted decisions
that hold an address are asked about. `commits` and `why` show the newest 30 of a list and say when there were more.

**A hook that suggests the trailer, if you want one.**

```sh
mnema commit-hook install     # writes the prepare-commit-msg hook in this repository
mnema commit-hook uninstall   # removes it, if mnema wrote it
```

Only these two verbs touch your hooks; `mnema init` does not. The hook goes where git reads hooks
(`core.hooksPath` when it is set, otherwise the repository's `hooks/`), and if a `prepare-commit-msg`
is already there that mnema did not write, `install` refuses and prints its path; `uninstall` removes
a file only when it is byte for byte the hook `install` writes. When you commit in an editor, the hook
appends a few `#` lines to the message naming the decisions in force that govern the staged files
(the reading that finds the rules for a path), each with its `Mnema-Decision:` line. Git drops `#` lines, so a
commit you leave alone is the commit you would have made; to cite a decision, delete the `# ` in front
of its line. **What it does not do.** It suggests and never decides: it does not check that the change
follows the decision, and it adds nothing to a message given with `-m` or `-F`, to a merge, an amend, or
under a `commit.cleanup` that keeps comments or a `core.commentChar` other than `#`. A `--cleanup=verbatim`
typed on the command line is not seen by the hook, and the block stays in the message, like git's own
comments. It needs `mnema` on the `PATH` git runs hooks with; when
`mnema` is missing or fails, the hook does nothing and the commit goes through. It looks for the
project from the repository's top directory, so a record kept in a subdirectory draws no suggestion.
