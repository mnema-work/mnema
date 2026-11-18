/**
 * WHAT THIS MACHINE HAS BEEN TOLD ONCE, kept in a file of its own in the global tree's directory, beside
 * `report-state.json` and in the same way: outside the proof. No event is written, nothing is signed, and
 * `verify` never reads it. It holds what a person is shown once per machine and should not be shown again.
 *
 * The file is tolerant to read and atomic to write (a staging file renamed over the name). A file that is
 * there and cannot be read FAILS CLOSED: it reads as everything already shown, so a bad byte never makes a
 * line come back, and nothing writes over it.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MACHINE_STATE_FILE = 'machine-state.json';

/** What the machine has been told. */
export interface MachineState {
  /** The line that suggests a GitHub star was shown, once, at the end of an `init` at a terminal. */
  readonly starShown: boolean;
  /** The file is there and cannot be read: it reads as shown, and nothing is written over it. */
  readonly unreadable?: true;
}

export const NOTHING_SHOWN: MachineState = { starShown: false };
const UNREADABLE: MachineState = { starShown: true, unreadable: true };

/** The state the file holds; a missing file is nothing shown, and one that cannot be read is everything shown. */
export function readMachineState(dir: string): MachineState {
  try {
    const file = join(dir, MACHINE_STATE_FILE);
    if (!existsSync(file)) return NOTHING_SHOWN;
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return UNREADABLE;
    if (parsed.starShown !== undefined && typeof parsed.starShown !== 'boolean') return UNREADABLE;
    return { starShown: parsed.starShown === true };
  } catch {
    return UNREADABLE;
  }
}

/** Writes the state whole, beside its final name first so a reader never sees half of it. */
export function writeMachineState(dir: string, state: MachineState): void {
  if (state.unreadable === true) return;
  mkdirSync(dir, { recursive: true });
  const staging = join(dir, `${MACHINE_STATE_FILE}.${process.pid}.tmp`);
  writeFileSync(staging, `${JSON.stringify({ starShown: state.starShown }, null, 2)}\n`);
  renameSync(staging, join(dir, MACHINE_STATE_FILE));
}
