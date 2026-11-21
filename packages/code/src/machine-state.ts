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
import { VERSION } from './version.js';

export const MACHINE_STATE_FILE = 'machine-state.json';

/** What the machine has been told. */
export interface MachineState {
  /** The line that suggests a GitHub star was shown, once, at the end of an `init` at a terminal. */
  readonly starShown: boolean;
  /** The first-run tour was opened, once, in place of the menu at a terminal (or by `mnema tour` at one). */
  readonly tourSeen: boolean;
  /** The version of mnema the last `mnema upgrade` that finished brought this machine's projects up to. */
  readonly appliedVersion?: string;
  /** The version the line about an update not yet applied was said for, once, at a terminal. */
  readonly noticedFor?: string;
  /** The file is there and cannot be read: it reads as shown, and nothing is written over it. */
  readonly unreadable?: true;
}

export const NOTHING_SHOWN: MachineState = { starShown: false, tourSeen: false };
const UNREADABLE: MachineState = { starShown: true, tourSeen: true, unreadable: true };

/** The state the file holds; a missing file is nothing shown, and one that cannot be read is everything shown. */
export function readMachineState(dir: string): MachineState {
  try {
    const file = join(dir, MACHINE_STATE_FILE);
    if (!existsSync(file)) return NOTHING_SHOWN;
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return UNREADABLE;
    if (parsed.starShown !== undefined && typeof parsed.starShown !== 'boolean') return UNREADABLE;
    if (parsed.tourSeen !== undefined && typeof parsed.tourSeen !== 'boolean') return UNREADABLE;
    if (parsed.appliedVersion !== undefined && typeof parsed.appliedVersion !== 'string') {
      return UNREADABLE;
    }
    if (parsed.noticedFor !== undefined && typeof parsed.noticedFor !== 'string') return UNREADABLE;
    return {
      starShown: parsed.starShown === true,
      tourSeen: parsed.tourSeen === true,
      ...(parsed.appliedVersion === undefined ? {} : { appliedVersion: parsed.appliedVersion }),
      ...(parsed.noticedFor === undefined ? {} : { noticedFor: parsed.noticedFor }),
    };
  } catch {
    return UNREADABLE;
  }
}

/**
 * Writes the state whole, beside its final name first so a reader never sees half of it.
 *
 * A file this call CREATES is made by the version that runs, on a machine where nothing older was run
 * that kept a file, so it says that version was applied: a first run's tour or star must not make the
 * next command read the machine as one an update left behind (`update-notice.ts`).
 */
export function writeMachineState(dir: string, given: MachineState): void {
  if (given.unreadable === true) return;
  const state =
    given.appliedVersion === undefined && !existsSync(join(dir, MACHINE_STATE_FILE))
      ? { ...given, appliedVersion: VERSION }
      : given;
  mkdirSync(dir, { recursive: true });
  const staging = join(dir, `${MACHINE_STATE_FILE}.${process.pid}.tmp`);
  writeFileSync(
    staging,
    `${JSON.stringify(
      {
        starShown: state.starShown,
        tourSeen: state.tourSeen,
        ...(state.appliedVersion === undefined ? {} : { appliedVersion: state.appliedVersion }),
        ...(state.noticedFor === undefined ? {} : { noticedFor: state.noticedFor }),
      },
      null,
      2,
    )}\n`,
  );
  renameSync(staging, join(dir, MACHINE_STATE_FILE));
}
