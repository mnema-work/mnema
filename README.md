<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner-dark.svg">
  <img src="docs/assets/banner-light.svg" alt="mnema: a signed, append-only record of the decisions behind AI coding agents' work" width="640">
</picture>

<h3>mnema is the decision record for AI coding agents.</h3>

<p>
Who decided this, and why? What was turned down? Has it changed since? When an agent settles a
choice in a chat that ends, nothing answers. mnema keeps the answer in the repository.
</p>

<p>
Your decisions, handed to your agents' sessions and held at the edits they govern: append-only and signed in the repository, and checkable by anyone.
</p>

<p>
<a href="https://github.com/mnema-work/mnema/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/mnema-work/mnema/ci.yml?branch=main&amp;style=flat-square&amp;label=CI&amp;color=997dbf"></a>
<a href="https://www.npmjs.com/package/@mnema/code"><img alt="npm: @mnema/code" src="https://img.shields.io/npm/v/@mnema/code?style=flat-square&amp;label=npm&amp;color=997dbf"></a>
<a href="LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-997dbf?style=flat-square"></a>
<img alt="Node 24.15.0 or a later 24, or 26.0.0 or later" src="https://img.shields.io/badge/node-%5E24.15.0%20%7C%7C%20%E2%89%A526.0.0-997dbf?style=flat-square">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/how-mnema-fits-dark.svg">
  <img src="docs/assets/how-mnema-fits-light.svg" alt="How mnema fits: an agent session opens with the decision in force; a write under the path a rule refuses is denied; a write elsewhere lands; a decision the agent records is signed into the chain in the repository; mnema verify checks the chain" width="100%">
</picture>

</div>

<table>
<tr>
<th align="center">Remember</th>
<th align="center">Enforce</th>
<th align="center">Prove</th>
</tr>
<tr>
<td align="center" width="33%">With the plugin, each agent session opens with the decisions in force, by name and id.</td>
<td align="center" width="33%">A rule addressed at a path can refuse an agent's write there, or hold it for a person where the host allows.</td>
<td align="center" width="33%">Every write the product makes ends in a signed checkpoint and is hash-chained; anyone can verify it, even in a browser, and a reader's guarantee runs up to the last checkpoint.</td>
</tr>
</table>

<p align="center">
Tamper-evident, not tamper-proof: what is still in the record has not changed
since it was signed, and a stranger can check that without your keys and without
installing this.
</p>

<p align="center">
<a href="#why">Why</a> · <a href="#status">Status</a> · <a href="#quick-start">Quick start</a> · <a href="#how-it-works">How it works</a> · <a href="#hosts">Hosts</a> · <a href="#the-mnema-family">Family</a> · <a href="#watch-it">Watch it</a> · <a href="#what-it-proves-and-what-it-does-not">What it proves</a> · <a href="#docs">Docs</a>
</p>

## Why

Your agents settle choices all day: a library, an approach, an option turned down. Those choices usually live in a chat
that ends, in one tool's memory or in somebody's head, where nobody can check who decided them or whether they were
changed since. mnema writes them down in the repository, next to the code, with their reasons and what was turned down.
The record is signed and only grows: a change of mind is a new entry that supersedes the old one, never an edit. Where
the host runs hooks, each session opens with the decisions in force, and anyone can check offline that what it holds
was not changed since it was signed. What is measured, and what is not, is on [the evidence page](docs/evidence.md).

## Status

- **On npm.** `@mnema/code` is published: install it with `npm i -g @mnema/code` ([`docs/install.md`](docs/install.md)); to run the `main` branch instead, see [Build from source](docs/build-from-source.md).
- **In the editor stores.** The VS Code extension is on the Visual Studio Marketplace and Open VSX as `mnema.mnema`, and still needs the `mnema` command from `@mnema/code`.
  <!-- not-on-the-site -->
- **These pages describe the next version** (the `main` branch). What has not reached npm yet is listed under Unreleased in the [Changelog](CHANGELOG.md).
  <!-- /not-on-the-site -->
- **Node.** Requires Node 24.15.0 or a later 24, or 26.0.0 or later.
- **From a checkout.** The GitHub Action and the SDK are not published, and run from a clone of this repository ([Packages](docs/packages.md)).

## Quick start

```sh
npm i -g @mnema/code                              # the binary
cd your-repository
mnema init                                        # founds the record in .mnema/
ADR=$(mnema decision record "Keep money as integer cents" "Float sums drift; cents are exact." | grep -o -m1 'ADR-[0-9]*')
mnema decision move accept "$ADR" --note "Agreed in review."  # a decision enters proposed; accepting puts it in force
mnema link "$ADR" src/billing --rel refuses-a-write            # the rule, addressed at a path
mnema verify   # reads the signed record; one line saying it is intact is the green
```

No agent has run yet: that is the record, a rule in force, and the proof. `ADR` holds the number
mnema printed for the decision you just recorded. In fish, whose
syntax differs, the first line is `set ADR (mnema decision record ... | grep -o -m1 'ADR-[0-9]*')`.
To hand the record to an agent, install the plugin for your host; in Claude Code:

```sh
claude plugin marketplace add mnema-work/mnema
claude plugin install mnema@mnema
```

Every other host is in [Hosts](docs/hosts.md). `mnema init` also writes the mnema
instructions into `AGENTS.md` and the other files agent hosts read, naming each; at a
terminal it first asks which hosts, and shows everything it will write before it writes it, and
`mnema instructions --remove` takes them out. The first record, step by step, is
[Your first record](docs/first-record.md).

## How it works

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/how-it-works-dark.svg">
  <img src="docs/assets/how-it-works-light.svg" alt="Record, rule, hand over, verify: over a signed, append-only record committed with the code" width="880">
</picture>

</div>

1. **Record.** An agent over MCP, or you at the command line, writes a decision with its reasoning and the options turned down, and a task with its description and a handoff with its brief.
2. **Rule.** A person accepts it, or an agent where `agent-accepts` is on (the default; an agent's acceptance is marked as its own), and `mnema link` addresses it at a path. The rule can govern that path, ask for a person there, or refuse a write.
3. **Hand over.** With the plugin, each session opens with what is in force (in Claude Code, so does each subagent), and each edit meets the rules for its file. In Claude Code, a note of the host's own memory is also copied into this machine's private tree, until you switch that off.
4. **Verify.** Every write ends in a signed checkpoint and is hash-chained; a reader's guarantee runs up to the last checkpoint. `mnema verify`, a second reader in Python, or the page `mnema site` writes checks it.

More in [`docs/how-it-works.md`](docs/how-it-works.md); what a session is handed, word for word, is in
[`docs/agent-hosts.md`](docs/agent-hosts.md), and how far each host goes is under [Hosts](#hosts).

## Hosts

mnema works with any agent host that has an MCP client, and how much more a host gets depends on
what its hooks allow, one rung at a time: (a) the MCP server and rules in a file, (b) the opening
of a session, (c) a refusal before a write, (d) a pause for a person.

<!-- The host summary below is generated from packages/code/src/host-names.ts: edit the table there. -->

| | Host | Rung | What it gets | Install |
| :---: | :--- | :---: | :--- | :--- |
| <img src="assets/hosts/claude-icon.svg" width="20" height="20" alt="Claude Code"> | **Claude Code**<br><sub>Anthropic · terminal and editors</sub> | **(d)** | MCP server · rules file · opening · refusal · pause · rules at an edit | [Plugin](docs/hosts.md#claude-code) |
| <img src="assets/hosts/vscode.svg" width="20" height="20" alt="VS Code"> | **VS Code**<br><sub>Microsoft · the agent of the editor</sub> | **(d)** | rules file · refusal · pause<br><sub>MCP server · opening: read once</sub> | [Plugin](docs/hosts.md#vs-code-and-cursor) |
| <img src="assets/hosts/cursor-brand-logo-12.svg" width="20" height="20" alt="Cursor CLI"> | **Cursor CLI**<br><sub>Cursor · command line</sub> | **(c)** | rules file<br><sub>MCP server · opening · refusal: read once</sub> | [Plugin](docs/hosts.md#vs-code-and-cursor) |
|  | **Codex**<br><sub>OpenAI · command line</sub> | **(c)** | MCP server · rules file · opening · refusal · rules at an edit | [Plugin](docs/hosts.md#codex) |
| <picture><source media="(prefers-color-scheme: dark)" srcset="assets/hosts/GitHub_Invertocat_White.svg"><img src="assets/hosts/GitHub_Invertocat_Black.svg" width="20" height="20" alt="GitHub"></picture> | **Copilot CLI**<br><sub>GitHub · command line</sub> | **(d)** | MCP server · rules file · opening · refusal · pause · rules at an edit | [Plugin](docs/hosts.md#github-copilot-cli) |
| <img src="assets/hosts/opencode-works-with-a-dark-20.svg" width="153" height="20" alt="Works with OpenCode"> | **OpenCode**<br><sub>Anomaly · command line</sub> | **(c)** | MCP server · rules file · opening · refusal · rules at an edit | [Plugin](docs/hosts.md#opencode) |
| <img src="assets/hosts/gemini-cli-icon.png" width="20" height="20" alt="Gemini CLI"> | **Gemini CLI**<br><sub>Google · command line</sub> | **(c)** | MCP server · rules file · opening · refusal · rules at an edit | [Plugin](docs/hosts.md#gemini-cli) |
| <img src="assets/hosts/qwen-code-logo.svg" width="20" height="20" alt="Qwen Code"> | **Qwen Code**<br><sub>Qwen · command line</sub> | **(c)** | MCP server · rules file · opening · refusal · rules at an edit | [Plugin](docs/hosts.md#qwen-code) |
| <img src="assets/hosts/cursor-brand-logo-12.svg" width="20" height="20" alt="Cursor"> | **Cursor**<br><sub>Cursor · editor</sub> | **(a)** | MCP server · rules file<br><sub>documented, not measured</sub> | [MCP server](docs/hosts.md#any-other-host-with-an-mcp-client) |
| <img src="assets/hosts/antigravity-favicon.svg" width="20" height="20" alt="Antigravity CLI"> | **Antigravity CLI**<br><sub>Google · command line (`agy`)</sub> | **(a)** | MCP server · rules file<br><sub>documented, not measured</sub> | [MCP server](docs/hosts.md#any-other-host-with-an-mcp-client) |
| <img src="assets/hosts/factory-favicon.svg" width="20" height="20" alt="Factory Droid"> | **Factory Droid**<br><sub>Factory · command line</sub> | **(a)** | MCP server · rules file<br><sub>documented, not measured</sub> | [MCP server](docs/hosts.md#any-other-host-with-an-mcp-client) |
| <picture><source media="(prefers-color-scheme: dark)" srcset="assets/hosts/logo_dark.png"><img src="assets/hosts/logo_light.png" width="20" height="20" alt="Goose"></picture> | **Goose**<br><sub>Agentic AI Foundation · desktop and command line</sub> | **(a)** | MCP server · rules file<br><sub>documented, not measured</sub> | [MCP server](docs/hosts.md#any-other-host-with-an-mcp-client) |

<!-- End of the generated host summary. -->

The logos beside the names of the hosts belong to their owners: Anthropic, Microsoft, Anysphere, GitHub, Inc., Anomaly, Google, the Qwen Code project, Factory and the Goose project. They identify the hosts mnema works with and imply no endorsement, either way. mnema is not theirs. Each file is the vendor's own, unmodified, and [its source is listed](assets/hosts/SOURCES.md); a host with no logo, Codex, is shown by its name.

Each cell of the full table, how each one is known (held by a test, read once on a real host, or
documented and not measured), and the notes on each host are in
[How each claim is held](docs/evidence.md#each-hosts-rung).

## The mnema family

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mnema-work/mnema/main/docs/assets/the-family-dark.svg">
  <img src="https://raw.githubusercontent.com/mnema-work/mnema/main/docs/assets/the-family-light.svg" alt="The mnema family: @mnema/code, the command line and the MCP server over one record, with the SDK, a VS Code extension, an agent in CI, the GitHub Action, mnema site and Stacks around it" width="880">
</picture>

</div>

`@mnema/code` holds the record, and the command line and the MCP server that read and write it. The rest stand around
it. The detail of most of them is in [Features](docs/features.md); for the rest, the Link column leads to the page that has it.

| Product | What it is for | Status | Link |
|---|---|---|---|
| **`@mnema/code`**<br><sub>the core</sub> | The signed, append-only record, with the command line and the MCP server over it. | `npm i -g @mnema/code` ([Install](docs/install.md)). | [Package](packages/code/README.md) |
| **GitHub Action** | On a pull request, comments what the change does to the record and fails the check when it is not signed. | Not published; runs from a clone of this repository. | [Package](packages/action/README.md) |
| **SDK** | A library door to the record, for a program that records, reads and verifies. | Not published; runs from a clone of this repository. | [Package](packages/sdk/README.md) |
| **VS Code extension** | Shows the rules in force over the open file, the decisions waiting for a judgment and the stacks adopted. | On the Visual Studio Marketplace and Open VSX as `mnema.mnema` (`code --install-extension mnema.mnema`); it runs the `mnema` command, so `@mnema/code` stays a prerequisite. | [Package](packages/vscode/README.md) |
| **Stacks** | Installs a set of skills and agents from a plan shown whole, and records the adoption as a signed fact. | Commands of `mnema`, not a package of their own; the contract they check against, `@mnema/stacks`, ships with `@mnema/code`. | [Stacks](packages/stacks/README.md) |
| **An agent in CI** | A pipeline's agent records with a key of its own, so what it records is signed as that agent. | A recipe, not a package. | [The recipe](packages/action/README.md#an-agent-in-ci) |
| **A page that verifies itself** | `mnema site` writes one HTML file, and the reader's browser checks it. | A command of `@mnema/code`, not a package. | [The page](docs/site.md) |

## Watch it

<table>
<tr>
<td width="50%" valign="top"><img src="recordings/first-record.gif" alt="mnema init, a decision recorded and accepted, the decisions the next session is handed, and verify"><br><sub>The first record: the command line in an empty repository, from <code>init</code> to <code>verify</code>. Recorded from the built binary by <a href="recordings/first-record.sh"><code>recordings/first-record.sh</code></a>.</sub></td>
<td width="50%" valign="top"><img src="recordings/a-tamper-caught.gif" alt="One word of a recorded decision changed by hand in the record's file, and mnema verify failing with entry hash mismatch"><br><sub>A changed word caught: one word of an accepted decision is changed by hand in its file, and <code>mnema verify</code> names the event whose hash no longer matches and exits 1. A cut that takes the newest events together with their checkpoint is not caught: a hash chain shows what changed, never what is gone (<a href="docs/what-it-proves.md">what it proves</a>). Recorded from the built binary by <a href="recordings/a-tamper-caught.sh"><code>recordings/a-tamper-caught.sh</code></a>.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="recordings/a-write-refused.gif" alt="An agent's write refused by a rule addressed at its path"><br><sub>A write refused: the rule addressed at the path stops an agent's edit there. Recorded from the built binary by <a href="recordings/a-write-refused.sh"><code>recordings/a-write-refused.sh</code></a>.</sub></td>
<td width="50%" valign="top"><img src="recordings/a-decision-superseded.gif" alt="A decision superseded: it leaves the rules the next session is handed, the call that replaced it names it, and it stays in the record"><br><sub>A decision superseded: a later call takes its place, the old one leaves the rules the next session is handed (the call that replaced it names it) and stays in the record. Recorded from the built binary by <a href="recordings/a-decision-superseded.sh"><code>recordings/a-decision-superseded.sh</code></a>.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="recordings/console.gif" alt="mnema at a shell, the first door, and the console answering reads"><br><sub>At a terminal, <code>mnema</code> alone asks what you want to do here, and its first door opens the console: a session that reads the record and refuses to write. It needs a window at least 80 columns wide and 42 rows tall. Driven through a pseudo-terminal by <a href="recordings/console.json"><code>recordings/console.json</code></a>.</sub></td>
</tr>
</table>

A case in the suite runs the scripts again against the built binary and fails when a recording no longer
shows what the binary draws, so none of them can go on showing an older product in silence
([`the-recordings-are-what-the-binary-draws.test.ts`](packages/code/tests/the-recordings-are-what-the-binary-draws.test.ts)).

## What it is not

Each of these is a choice with a reason, and the reasons are in [Where it fits](docs/where-it-fits.md#what-it-is-not).

- **Not a semantic memory.** Search is by the words written in a record; there are no embeddings.
- **Not an agent runner.** It calls no model and runs no tool for the agent.
- **Not a copy somewhere else.** The committed record travels with the repository, and what you record privately stays on this machine, apart from the notes and the private rules your agent's host receives, when a session opens through the plugin and when the agent asks for them, which the host sends to its model; the witness verbs send a digest out, and with Sigstore the identity too, only when you run them.
- **Not access control.** The gate refuses an illegal move; it does not decide who may write.

## What it proves, and what it does not

`mnema verify` reads the events and the committed public keys of a project's trees (no private
key, no network) and prints each verdict verbatim, naming the level it reached.

- **What holds.** A changed or reordered event breaks the hash chain, and an edit made without the signing key is caught where the signed checkpoints remain; `verify --require=signed` fails when they were taken out.
- **What does not hold.** Nothing proves that nothing was removed: a hash chain shows what changed, never what is gone, and the history a git remote keeps is what covers omission. A record forged whole under a fresh key verifies clean, a key is not proven to be the person a name says, and the agent named on a fact is the name its client announced, unless an agent key signed it (then the name the record enrolled the key under). An agent key's role and its retirement are facts of the record that holds them: `verify` crosses a project's trees for a retirement, and a reader of one tree does not. A refusal of a write covers a host's editing tools, not its shell: `sed -i` on a protected file goes round it.
- **What a green `verify` means.** That nothing *verifiable* is broken, not that the record is honest, and the gate protects the shape of a change, not who may make it.

The whole table, claim by claim, is in [`docs/what-it-proves.md`](docs/what-it-proves.md); how each
claim about the agent hosts is held, and which are not held yet, is in [`docs/evidence.md`](docs/evidence.md).

## Docs

- **Get started.** [Install](docs/install.md) · [Your first record](docs/first-record.md) · [Hosts](docs/hosts.md)
- **Learn.** [How it works](docs/how-it-works.md) · [What a session is handed](docs/agent-hosts.md) ·
  [Where a rule arrives](docs/rule-arrival.md) · [What it proves](docs/what-it-proves.md) ·
  [Recording decisions](docs/recording-decisions.md) · [Rules and the commits that cite them](docs/rules-and-the-commits-that-cite-them.md) ·
  [Committing the record](docs/committing-the-record.md) · [A second machine and your key](docs/a-second-machine-and-your-key.md) ·
  [A record that inherits another](docs/a-record-inheriting-another.md) ·
  [Importing the decisions you already wrote](docs/importing-the-decisions-you-already-wrote.md) ·
  [Switching off what is handed to a model](docs/switching-off-what-is-handed-to-a-model.md) ·
  [The session journal and compaction](docs/the-session-journal-and-compaction.md) · [As an MCP server](docs/as-an-mcp-server.md) ·
  [Features](docs/features.md) · [Where it fits](docs/where-it-fits.md) ·
  [mnema next to a folder of ADRs](docs/mnema-next-to-a-folder-of-adrs.md) · [Windows and macOS](docs/platforms.md) ·
  [When two machines disagree](docs/convergence.md) · [Glossary](docs/glossary.md)
- **Reference.** [Commands](docs/reference/commands.md) · [MCP tools](docs/reference/mcp-tools.md) · [Switches](docs/switches.md) ·
  [The command reference](docs/cli-reference.md) · [The record format](packages/chain/FORMAT.md) · [Packages](docs/packages.md) ·
  [SDK](packages/sdk/README.md) · [GitHub Action](packages/action/README.md) ·
  [VS Code extension](packages/vscode/README.md) · [Stacks](packages/stacks/README.md) · [The plugin](plugin/README.md) ·
  [Porting it to a host](plugin/porting-to-a-host.md)
- **Project.** [How each claim is held](docs/evidence.md) · [The page that verifies itself](docs/site.md) ·
  [Verify without installing](docs/verify-without-installing.md) · [What comes next](docs/what-comes-next.md) ·
  [Contributing](CONTRIBUTING.md) · [Build from source](docs/build-from-source.md) ·
  [Security policy](SECURITY.md) · [Changelog](CHANGELOG.md)

## License

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
