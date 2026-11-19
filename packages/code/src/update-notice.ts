/**
 * AN UPDATE INSTALLED AND NOT YET APPLIED, said once (ADR-413, ADR-414).
 *
 * "Not applied" means the version that runs is newer than the last one a finished `mnema upgrade` (or
 * `doctor --after-update`) wrote into the machine's state file (`machine-state.ts`). The only thing read
 * is that one small file: no project, no network.
 *
 * A machine with no state file at all is a NEW installation, not an update: nothing is said, and the
 * first verb a person runs there notes the running version as applied (`noteTheVersionOnTheFirstVerb`),
 * so a later update is told; `init`, the server and `upgrade` write nothing. A file that is there without a version belongs to a
 * machine an earlier mnema ran on, which no upgrade has brought up since, so it is behind.
 *
 * The command line says one line, once per machine and version, and only to a person at a terminal
 * (`program.ts`); the MCP server says one note, once per connection (`mcp/server.ts`). Neither is ever
 * said in a hook, under `--json`, or in the opening text, and neither says to install anything.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  MACHINE_STATE_FILE,
  NOTHING_SHOWN,
  readMachineState,
  writeMachineState,
} from './machine-state.js';
import { isOlderThan } from './version.js';

/** The line the command line prints on standard error. */
export function updateLine(version: string): string {
  return `mnema ${version} is installed and \`mnema upgrade\` has not run on this machine since: it says what it changes here.`;
}

/** The note an MCP reply carries, in the manner of the one about `mnema report`: for the person, never for the agent to act on. */
export function updateNote(version: string): string {
  return `mnema ${version} is installed and \`mnema upgrade\` has not run on this machine since. Tell the person they can run \`mnema upgrade\`: it says what it changes here. Never update on your own.`;
}

/**
 * Whether the running version is ahead of what an upgrade last brought this machine to. Where it cannot
 * say (a state file that cannot be read, a directory that cannot be written) it is not: a doubt is silence.
 *
 * It only reads: a machine's directory is left as it was found (`init` and the server promise as much).
 * The file a machine does get is made by the first thing that keeps one (the tour, the star, an upgrade,
 * or the first verb a person runs at a terminal), and `writeMachineState` puts the running version into
 * a file it creates.
 */
export function updateIsNotApplied(dir: string, version: string): boolean {
  try {
    if (!existsSync(join(dir, MACHINE_STATE_FILE))) return false;
    const state = readMachineState(dir);
    if (state.unreadable === true) return false;
    return state.appliedVersion === undefined || isOlderThan(state.appliedVersion, version);
  } catch {
    return false;
  }
}

/**
 * The first verb a person runs at a terminal on a machine that has no state file notes the running
 * version as the one applied, so that a machine which only ever used a host's plugin is told after a
 * later update. A machine is nothing to note while a file is there (read it as it is, an unreadable
 * one included). `init`, the server and `upgrade` never call this: they keep the home as it was found.
 */
export function noteTheVersionOnTheFirstVerb(dir: string): void {
  try {
    if (existsSync(join(dir, MACHINE_STATE_FILE))) return;
    writeMachineState(dir, NOTHING_SHOWN);
  } catch {
    // A directory that cannot be written is a notice not given later.
  }
}

/**
 * The line for a person at a terminal, once per machine and version: it marks `noticedFor` when it
 * hands the line over, so the next run is silent. Without a terminal it neither says nor marks.
 */
export function updateLineOnce(
  dir: string,
  version: string,
  atATerminal: boolean,
): string | undefined {
  if (!atATerminal || !updateIsNotApplied(dir, version)) return undefined;
  try {
    const state = readMachineState(dir);
    if (state.noticedFor === version) return undefined;
    writeMachineState(dir, { ...state, noticedFor: version });
  } catch {
    return undefined;
  }
  return updateLine(version);
}

/** What a connection owes: the note, once, on the first reply that asks. */
export class UpdateNoteOwed {
  private asked = false;

  constructor(
    private readonly dir: string,
    private readonly version: string,
  ) {}

  /** The note on the first call, nothing on every later one. */
  take(): string[] {
    if (this.asked) return [];
    this.asked = true;
    return updateIsNotApplied(this.dir, this.version) ? [updateNote(this.version)] : [];
  }
}
