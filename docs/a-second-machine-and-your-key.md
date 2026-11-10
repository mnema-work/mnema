# A second machine, and your key

Bringing a second machine into your identity, where the private key lives, and a key that signs for its person under a name.

## Bringing a second machine into your identity

Your identity is one anchor with several keys, and each machine holds its own key:
the private half never travels. So a laptop joining your desktop's identity is
a handshake in three steps, run on the machine each step belongs to:

```sh
# On the NEW machine, in a clone of the repo (or anywhere: this touches no
# record). It creates this machine's key if it has none, and prints a request.
mnema key request --anchor mnid:c0fc3c713f09a43384ac08f7d91fca43…
#> Created this machine's key 8f21ab…
#>   to join mnid:c0fc3c713f09a43384ac08f7d91fca43…
#>
#> mnema-key-request:1:eyJwdWIiOiItLS0tLUJFR0lO…

# On a machine ALREADY in that identity, inside the project. Paste the line.
mnema key enroll 'mnema-key-request:1:eyJwdWIiOiItLS0tLUJFR0lO…'
#> Enrolled key 8f21ab…
#>   into mnid:c0fc3c713f09a43384ac08f7d91fca43…
#>   Commit and share the record: the other machine joins by reading it.

# Commit and push, so the new machine can read the vouch. Then, back on it:
mnema memory "first note from the laptop"
#> Captured memory 019fa4ef-1425-72f9-9058-0cd55236376f
```

That last write is where the new machine settles which identity it serves here:
it reads the vouch out of the record and speaks as that anchor from its first
fact onward. Nothing was decided by asking: only by being vouched for.

The request is not a secret: it is a public key plus a signature over public
values, so it is safe to paste into a chat or a ticket. It proves consent to join
**one** identity and is worthless to anyone who is not already a member of it:
only a member's vouch turns it into a fact. And a machine never admits itself:
that is why the middle step runs somewhere else.

`mnema audit accountability` is the check that it worked: one author, not two.

To take a key back out (a stolen laptop, a leaked backup copy):

```sh
mnema key revoke 8f21ab… --reason "laptop stolen"
```

Retirement is **forward-only**: what that key signed while it was a member stays
valid, because a rotation should not make past work unattributable. The identity's
last key cannot be retired (it would leave an identity unable to sign anything
again, including its own repair), so bring the replacement in first.

## Where your private key lives, and a passphrase for it

Each machine signs with one Ed25519 key, and its private half is one file:
`<MNEMA_HOME>/identity/keys/<fingerprint>.key` (`~/.mnema/identity/keys/…` when
`MNEMA_HOME` is not set). That file is the key's PKCS#8 PEM **in the clear**, created with mode
`0600` and never re-checked afterwards, in a directory made with your umask. The cold backup
`mnema init` makes sits beside it, in `identity/backup/`, in the same form. Whoever can read
those files can sign as your identity, and a copy of the disk (a stolen laptop, a synced home
directory, a backup) is a copy of the identity. Nothing in the record protects the key; the
proof is only that a signature was made by it.

You can put a passphrase on it, and nothing else changes. At a terminal `mnema key protect` asks
for it, twice and with nothing echoed; the variable does the same where there is no terminal:

```sh
mnema key protect                       # asks twice
#> New passphrase for the private key:
#> Again:
#> Protected 2 of 2 private key file(s)
#> …
export MNEMA_KEY_PASSPHRASE='a long passphrase of your own'   # or, with no terminal to ask at
mnema key protect
```

`protect` encrypts the key and its backup in place (scrypt, then AES-256-GCM, written
atomically with mode `0600`). The signed format is untouched: it is the same key and the same
signatures, no event or checkpoint says whether a key is protected, and `mnema verify` never
opens a private key, so a record written with a protected key verifies with no passphrase at all.
Anything that **signs** needs the same passphrase: at a terminal, `mnema` asks for it once per
command; where there is no terminal (a script, a pipe), it needs `MNEMA_KEY_PASSPHRASE` set to the
same value. An agent's host and a hook have no terminal either, and are **not** the place for the
passphrase: they sign with a key of their own (`key request --agent`, `key enroll
--agent`, below). With the passphrase missing or wrong a write is refused
(`KEY_IS_PROTECTED`, `KEY_PASSPHRASE_WRONG`), nothing is recorded, and no second identity is
created on the way. `mnema key unprotect` writes the files back in the clear, and a wrong
passphrase changes none of them.

What it does **not** do: a process running as you can read the variable from its own environment
and the opened key from the process that holds it; a keylogger sees the passphrase typed; and a
short passphrase is a short passphrase. It protects the key at rest, which is what the file in
the clear did not. The prompt appears only where both the input and the error stream are a
terminal, so a server, a hook or a pipe is never made to wait for a line nobody will type; the
system keychain is not a source. A lost passphrase is a lost key, the cold backup included if it was
protected too: keep the passphrase where you keep that copy.

## A key that signs for its person, under a name

The record can also say that a key is an identity's agent: a key a person lets a program sign with,
without handing it the key that enrols, revokes and declares. A member of the identity writes an
`agent.enrolled` naming the key and a name, and the key signs, over the UTF-8 of
`agent-enroll:<anchor>:<agentFp>:<name>`, that it consents to that name. `mnema verify` judges those
two facts (`agent.enrolled`, `agent.retired`), and three verbs write them.

**Making one, enrolling it, retiring it.**

```sh
mnema key request --agent claude --anchor <identity>     # where the agent's key will live
mnema key enroll --agent <the line it printed>           # where your own key is
mnema key revoke --agent <fingerprint> --reason "<why>"  # when it should sign nothing more
```

`request` makes the key in a folder of its own, `agents/<name>/` under the data directory (`~/.mnema`,
or `$MNEMA_HOME`), never beside your own key, and writes it in the clear: the host that signs with it
has no terminal to ask a passphrase at. A name begins with a lower-case letter or a digit, then holds
letters, digits, dots, dashes and underscores, up to 64 characters in all, and it is also the folder. `enroll` is run where your own key
is, and asks its passphrase at the terminal where the key has one. It records `agent.enrolled` in the
project's committed tree and, where the key lives on this machine, in the project's private tree and the
machine's global one too (outside a project, the global tree alone), so what the agent writes in each is
signed by it: one line per tree says `enrolled`, `already` or `skipped`, and it exits 1, with what the
other trees took kept, when one tree refuses. Where the key lives here, `mnema key enroll --agent <name>` takes
the name for the line; a line from elsewhere (a CI runner's key) is enrolled in the committed tree alone.
On a machine that begins every job empty, `mnema key restore --agent <name> <file>` puts that key into the
agent's folder (`agents/<name>/` under the data directory): it refuses, before it writes anything, a key
the committed record does not enrol as that agent under that name, one the record retired, one that is not
Ed25519 or is protected by a passphrase, and a folder that holds another key; it appends nothing to the
record and installs nothing beside your own key. The [Action's page](../packages/action/README.md#an-agent-in-ci)
has the whole recipe.
A tree created after the verb ran is not enrolled: run it again, and the trees that have the agent say
`already`. A key retired in any of the trees is refused in all of them, and nothing is written.
It says so when your key is unencrypted, because then anything that can read your home can sign
as you and the agent key separates nothing. `key revoke <fingerprint>` refuses an agent key and names
the verb that retires it, and an agent key does not count as one of an identity's keys where the last
one may not be retired. `key revoke --agent` retires it in every tree of this machine that enrolled it (another machine's private and global trees keep counting it until it is retired there, and `mnema verify` there, once the committed tree with the retirement is pulled, refuses in the trees it verifies what the key signed after the retirement). `key request --key <file>`, `key enroll <line>` and `key enroll --checker <line>` refuse an agent's key (`AN_AGENT_KEY`), told by its fingerprint: one this machine keeps for an agent, in use or retired, or one a record they reach enrols as an agent, wherever its file is kept. A retired key
is never enrolled again: `key request --agent <name>` after a retirement puts the retired key in
`agents/<name>/retired/` (it is never deleted) and makes the agent a new key under the same name, which
`enroll` takes in the same way. The record allows more than one active key under a name, each counted by
its own fingerprint, because a person with two machines has two keys under the name a host's manifest
fixes; `enroll` says when it finds another and does not refuse.

**Signing with it.** `mnema mcp --agent-key <name>` (or `MNEMA_AGENT_KEY=<name>`, which a `mnema` from
before the option ignores where an argument would stop it; the flag wins), `mnema before-a-write
--host <host> --agent-key <name>` (read from the variable too; the flag wins) and the verbs of the command
line that write a fact an agent's key may sign (every writing verb but `init`, `key …` and `check run`, which
do not read the variable), with `MNEMA_AGENT_KEY=<name>` in their environment, sign with that key in each tree whose record enrols it under exactly
that name (`key enroll --agent` writes the committed, the private and the global tree), and the `which`
of every fact is the name the record of the tree it lands in gives the signing key, whatever the client
announced. In a tree whose record does not enrol it (a project the verb has not been run in, a tree made
since, a machine with no key under that name), the person's key signs, and the `which` stays declared;
where your own key is protected and `MNEMA_KEY_PASSPHRASE` is not in the environment, or is not on this
machine, the write is refused (`AGENT_NOT_ENROLLED`; in the hook what is not done is the recording of the fact, and the
reply to the host is unchanged and says why), naming the verb `key enroll --agent`, and nothing is signed, minted or founded. The
server opens and serves its reads on a machine where no key signs, each write is refused in the tree it was for, and a
session that only reads makes no key. The
server says, on its error stream, one line for each tree where the agent is not the one that signs, when it opens
and again when the session lands on a project; a name that is no agent's at all is said once, when it opens, and not
again for each tree or when the session lands. A key the record retired in any tree the process reaches is
not passed over to yours: its writes are refused in all of them (`REVOKED_KEY`). A key the record proves a member
of two identities signs for neither (`AMBIGUOUS_MEMBERSHIP`). A name this product does not enrol is no agent and
no stand-in: every write is refused (`AGENT_NAME_REFUSED`), naming the name that came and the form accepted, and
nothing is made, your own key and an identity included; in the hook it is the recording that is not done. A `--which` that names another than the record's name is not recorded where the agent
signs, and a line on the error stream says so; `mnema memory` and `mnema observe` with the variable and no
`--scope` go to the private tree, where a CI runner has no key that enrols the agent: the write is refused.
The hooks of `corrections` sign with your key unless `MNEMA_AGENT_KEY` is in their environment (the manifests
pass it to the server only).
In Claude Code, VS Code and Cursor, which read one manifest, the plugin's `agent_key` option is empty by
default, and in Claude Code an empty option leaves a `MNEMA_AGENT_KEY` of the host's environment in force (that the option, and `MNEMA_AGENT_KEY`, reach the server was not measured on VS Code or Cursor); the manifests of Codex, Copilot CLI and Gemini CLI name their own host; the hook files of
every host whose hooks are processes pass the host's name too. `mnema doctor` lists the agent keys
this machine holds against the record of each tree (the committed, the private and the global one) and, on a machine that
holds an agent key already, names the agents the files generated for each host ask for that no key is held under; it says
too when `MNEMA_AGENT_KEY`, in the environment of the `doctor` itself and not the host's, names one it does not hold.
For a host with no manifest of this plugin, put `--agent-key <name>` in the host's user configuration, not in a
project's: a host's project configuration is what the model writes, so the choice of key does not go there.

`mnema show <id>` marks a decision's recorder or ruler that an agent key signed (`agent claude, attested
by its own key`), and `mnema audit accountability` says, beside an author, `claude 40 (38 attested)` for an agent whose
key signed some of its facts; with `--json` each agent carries how many of its facts the record's own agent key
signed (`attested`, absent where none). That is read from the index, as `show` reads everything; `mnema verify`
is what judges it.

**What `mnema verify` holds an agent key to.** The key is a member of the identity that enrolled it,
and what it signs is refused unless all of this holds: its `who` is that identity's anchor; its
`which` is, byte for byte, the name the key was enrolled under; and its kind is not one that
changes who may sign or what a key may sign (`identity.founded`, `key.enrolled`, `key.revoked`,
`backup.declared`, `checker.enrolled`, `checker.retired`, `agent.enrolled`, `agent.retired`,
`account.linked`). A key already in an identity, holding a role, or retired from one, cannot be enrolled as an agent.
A name may not begin or end with a character of the set `FORMAT.md` section 6.2 writes out, and may
not be the anchor itself. The Python reader in `packages/chain/verifier` judges the same, and the two
are tested to agree.

**A retired agent key signs nothing.** Only the identity that enrolled the key retires it, by a key
of its own that is not an agent key, and the retirement counts only once a checkpoint covers it. From
then on `verify` refuses any event the key signs. What it signed before still verifies, and the census
names it, as it names a retired checker's results (`census [retired-agent] …`, with and without `--verbose`):
a leaked key can date a fact before its own retirement, so the record no longer vouches for those facts.

**What the census says, and what it does not.** A fact that `verify` accepts from an agent key is
counted per key (`census [attested-which] …`: that key, enrolled as that name, signed that many
facts). A `which` written by a key without the role is counted as declared (`census
[declared-which] …`, shown with `--verbose`): the key that signed stated it, and nothing attests it. All three are informational:
none moves the verdict or the exit code. The record does not say which process held the agent
key, nor which model drove it; that is a property of the machine, and a program with access to the
key signs as that agent.
