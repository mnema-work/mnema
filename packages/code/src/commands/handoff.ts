/**
 * `mnema task handoff <task> <from> <to>`: record a handoff on a task.
 *
 * A sibling of `memory` and `observe`, differing in that it mints NO id: a
 * handoff has no standalone identity; its subject IS the task, and it is an
 * entry in that task's history. So the command reports the FACT (the task and
 * the two agents), not an id there is none of.
 *
 * All three inputs are POSITIONAL (`<task> <from> <to>`): they are short
 * ids/labels, not a body of text, so none competes for the tail of the line the
 * way an observation's text would. `from == to` is legitimate (a chat restart
 * with the same agent) and is not refused: the core accepts it and so does the
 * surface.
 *
 * The `task` has to exist in a tree this project reads: an id no tree holds is refused
 * (`UNKNOWN_TASK`), because a handoff recorded about nothing is a brief no one can find from
 * the task it was meant for.
 *
 * The birth scope: an explicit `scope` wins; when omitted, the handoff (and its brief)
 * FOLLOWS THE TASK to the tree that holds it, as a move does, so a private task's brief is
 * never committed by a handoff that named no tree. The `which` is the agent that
 * RECORDED the handoff, distinct from the `from`/`to` agents it is about (the
 * recorder may be neither), and it names the agent without moving the tree.
 */

import { catalogUpcasters } from '@mnema/chain';
import { chainRootForScope, type DiscoveryEnv, resolveScope, type Scope } from '@mnema/core';
import { openTreeForWriting, recordHandoff } from '@mnema/core/write';
import { oneLine } from '../one-line.js';
import { forwardReplacement, type Landed, type Replacement } from '../recorded-content.js';
import { locateEntityScopeKept } from '../tree-sources.js';
import {
  type AgentWrites,
  originOfTheWrite,
  treesToWrite,
  whichOfTheWrite,
} from './write-as-the-agent.js';

/** What the handoff command needs: injected so it is testable. */
export interface HandoffContext extends Pick<AgentWrites, 'agentKey' | 'say'> {
  /** The working directory to resolve the project from. */
  readonly cwd: string;
  /** The discovery environment (`$HOME`, `$MNEMA_HOME`). */
  readonly env: DiscoveryEnv;
}

/** A handoff was recorded: the fact, with its references (there is no id). */
export interface HandoffRecorded extends Replacement, Landed {
  readonly ok: true;
  /** The task the handoff is about (the event subject). */
  readonly task: string;
  /** The agent handing off. */
  readonly fromAgent: string;
  /** The agent taking over. */
  readonly toAgent: string;
  /** The observation that carries the brief, when one was given. */
  readonly briefId?: string;
}

/** The record was refused. */
export type HandoffRefused =
  /** There is no project here: a project-scoped handoff needs one. */
  | { readonly ok: false; readonly reason: 'NO_PROJECT' }
  /** The core operation refused (e.g. the authority invariant). */
  | {
      readonly ok: false;
      readonly reason: 'REFUSED';
      readonly code: string;
      readonly message: string;
    };

/**
 * Records a handoff, routing its birth to the resolved scope. The scope rule is
 * the one every birth follows: an explicit `scope` wins, else the tree the KIND
 * names (public). A `task` no tree holds is refused `UNKNOWN_TASK`, before anything is
 * written. On success it echoes the fact back (task, from, to; there is no
 * minted id to return) plus the tree it landed in. A declared `which` is recorded
 * on the event and does not move the tree.
 */
export function runHandoff(
  ctx: HandoffContext,
  input: {
    task: string;
    fromAgent: string;
    toAgent: string;
    brief?: string;
    scope?: Scope;
    which?: string;
    run?: string;
  },
): HandoffRecorded | HandoffRefused {
  const writing = treesToWrite(ctx);
  const { trees } = writing;
  // The tree that holds the task, which a handoff with no scope follows. A task no tree holds is
  // refused below, by the door's own ask, so a handoff the door refuses for its shape is refused
  // for that first, and nothing is founded for either.
  const home = locateEntityScopeKept(trees, input.task, catalogUpcasters());
  // With no scope named, the task's own tree: the brief is up to 64 KiB of text and
  // belongs where the task does. Only a task no tree holds falls to the kind's default.
  const scope =
    input.scope ??
    home ??
    resolveScope('handoff.recorded', originOfTheWrite(writing, input.which), input.scope);
  if (scope !== 'global' && trees.projectPublic === undefined) {
    return { ok: false, reason: 'NO_PROJECT' };
  }

  const which = whichOfTheWrite(writing, scope, input.which);

  const writer = openTreeForWriting(trees, scope);
  const recorded = writer.exclusively(() => {
    const written = recordHandoff(
      {
        writer,
        layout: { root: chainRootForScope(trees, scope) as string },
        upcasters: catalogUpcasters(),
        askedBeforeFounding: () =>
          home === undefined
            ? {
                ok: false,
                code: 'UNKNOWN_TASK',
                message: `task "${oneLine(input.task)}" was not found in any tree this project reads`,
              }
            : undefined,
      },
      {
        task: input.task,
        fromAgent: input.fromAgent,
        toAgent: input.toAgent,
        ...(input.brief !== undefined ? { brief: input.brief } : {}),
        ...(which !== undefined ? { which } : {}),
        ...(input.run !== undefined ? { run: input.run } : {}),
      },
    );
    // Checkpoint so the new handoff is signature-covered at once.
    if (written.ok) writer.checkpoint();
    return written;
  });
  if (!recorded.ok) {
    return { ok: false, reason: 'REFUSED', code: recorded.code, message: recorded.message };
  }

  return {
    ok: true,
    task: input.task,
    // The labels AS RECORDED, not as asked for: if a label carried a credential the
    // record holds a placeholder, and the echo has to show what landed.
    fromAgent: recorded.fromAgent,
    toAgent: recorded.toAgent,
    ...(recorded.briefId !== undefined ? { briefId: recorded.briefId } : {}),
    scope,
    ...forwardReplacement(recorded),
  };
}
