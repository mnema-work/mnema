# North star

One page on what mnema is for, so a change can be weighed against it.

## What it is

mnema is a signed, append-only record of the decisions behind the work of AI agents, kept in
the repository where the work happens. Anyone with the files, and no private key and no network,
can run `mnema verify` (or the [second reader](verify-without-installing.md)) and learn whether
the events are the ones that were signed, in order; what that does not prove is in
[What it proves](what-it-proves.md).

## What mnema is not

- **Not a semantic memory.** Search is by the words written in a record; there are no embeddings.
- **Not an agent runner.** It calls no model and runs no tool for the agent.
- **Not a copy somewhere else.** The committed record travels with the repository, and what you record privately stays on this machine, apart from the notes and the private rules your agent's host receives, when a session opens through the plugin and when the agent asks for them, which the host sends to its model; the witness verbs send a digest out, and with Sigstore the identity too, only when you run them.
- **Not access control.** The gate refuses an illegal move; it does not decide who may write.

The reasons are in [Where it fits](where-it-fits.md#what-it-is-not).

## The rule: what serves the proof wins

When two ways of doing something pull apart, the one that keeps the record checkable wins over
the one that is more convenient. For the scope of a version this means three things:

- A high finding on the proof (something the verify command or a page promises that is not held) is
  fixed before any new surface enters the version: no new host, verb or page while one is open.
- Every version's cut cites the line of this page it serves.
- A cut gains an item only by losing one, by a decision that says which.

See [How changes are made here](../CONTRIBUTING.md#how-changes-are-made-here) for the practice
that follows from it.
