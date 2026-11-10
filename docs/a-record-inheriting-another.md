# A record that inherits another repository's decisions

A project can read the decisions in force of another repository (a team's shared conventions, say)
without copying them in. `mnema inherit set <origin> --at <revision> --write` writes
`.mnema/inherit.json`, a committed file naming the origin and **one commit** of it; `mnema inherit
update` moves that commit and prints what changes first. Without `--write`, both print what would
be inherited and write nothing.

```sh
mnema inherit set ../team-decisions --at main
mnema inherit update --to main --write
```

`mnema brief` then prints the inherited decisions in force in a section of their own, naming the
origin and the commit. They are read and never written: this project does not sign them, its
`verify` does not count them, and nothing is added to its chain. **What it proves** is that the
record at that commit verifies with the same check as the project's own, and a record that does
not verify there contributes nothing, and the brief says so. **What it does not prove** is that the
origin is the one you meant or that it deserves trust: pointing at an origin is trusting it at that
commit, and the commit never moves unless `inherit update --write` moves it. Only `set` and `update`
use the network; a read uses this machine's copy, kept under the mnema home and not in the project,
and says when the commit is not there yet.

**The commit fixes the record, and `update` does not move to another one.** `set` and `update`
print the name of the record at the commit (`The record there is <name>`, or that it names none,
written before records were named). Nothing beside the commit is written: `update` reads the
record at the commit it leaves, and where the origin holds another record at the new one (it
replaced its record), it refuses with `ANOTHER_RECORD`, with or without `--write`, naming both;
pointing at another record is `inherit set` over a project that points at none. A record from
before records were named may take a name, and only the one its genesis derives (the name
its first write from 0.1.5 on gives it); any other is refused the same way.

**An inherited rule reaches the path it addresses.** A link the origin's record holds under
`governs`, `asks-for-a-person` or `refuses-a-write` is an address in the project that inherits it,
read against that project's root, by path segments, the way the project's own are: a rule of the
origin addressed at `packages/php/src` covers `packages/php/src/Foo.php` here, and in a project with
no such directory it covers nothing until a file is written under it. So `mnema rules <path>`, `mnema why <path>`, the `governing_rules`
tool and the gate before a write (the MCP tool Claude Code's hook calls and `mnema before-a-write`)
list an inherited rule beside the project's own, and each inherited rule says where it comes from
(`inherited from <origin> at <commit>`, the first 12 characters of the commit). Neither is chosen
over the other: where a rule of the project and a rule of the origin address the same path, both are
listed. A rule of the origin that refuses a write or asks for a person applies as one of the
project's would, only where it addresses the path, and the refusal says the rule is addressed here
by the record this project inherits and names its origin. Where a refused rule is held only by the
origin's record, the refusal says so and names the clone it opens in (`mnema show <id>` opens it in
a clone of `<origin>` at `<commit>`), because `mnema show <id>` here finds nothing. The
`channel.refused` or `channel.asked` this project records cites the rule's id and nothing more: not
that the address was inherited, nor the origin and the commit.

**What is inherited is the address.** A line is labelled by the record that writes the link (the
address), not by the record that holds the rule. So a link the origin's record holds to a rule of
the project (`mnema link <project-rule-id> README.md --rel refuses-a-write`, run in the origin)
means: the rule is the project's, the address is the organization's. Every line it reaches, the
refusal, the asking, `mnema rules` and `governing_rules`, says `inherited from <origin> at <commit>`,
and the rule still opens here with `mnema show <id>`, which lists only the addresses the project's
own record holds.

An address of the origin that names nothing in this project's
working tree is not counted as one of the project's stale addresses. The three count lines of
`mnema rules` count "in this project" the project's own record alone (an inherited row that covers
the path is still counted among those that govern, ask or refuse "here"), and one more line counts
the inherited addresses by relation (`inherited from <origin> at <commit>: N addresses (G govern,
A ask for a person, R refuse a write), M name nothing in this project`). `mnema brief` counts, after
the project's own three, the rules the inherited record places at an address (how many govern, ask
for a person and refuse a write), and says the counts before it are the project's alone. A record that does not verify at the pinned commit, or that this machine has not fetched,
governs nothing here, and `rules`, `why` and `governing_rules` say so in one line; the gate says
nothing for it. The switches that turn a channel off are the project's own: the origin's are not
read. The verdict is kept for the life of a process, so the server a host keeps up verifies the
inherited record once per connection; a project with no `inherit.json` pays one file test. `mnema
rules-file`, the commit hook and `mnema aging` do not read the inherited record, and `mnema show`
does not list the addresses it holds.
