import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MACHINE_STATE_FILE,
  NOTHING_SHOWN,
  readMachineState,
  writeMachineState,
} from './machine-state.js';
import { VERSION } from './version.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mnema-machine-state-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('what this machine has been told', () => {
  it('has been told nothing where there is no file', () => {
    expect(readMachineState(join(dir, 'absent'))).toEqual(NOTHING_SHOWN);
  });

  it('reads back what was written, and leaves no staging file beside it', () => {
    const inside = join(dir, 'global');
    writeMachineState(inside, { starShown: true });
    expect(readMachineState(inside)).toEqual({ starShown: true });
    expect(readdirSync(inside)).toEqual([MACHINE_STATE_FILE]);
  });

  it('keeps the version an upgrade brought things to beside what was shown, and reads a wrong type as unreadable', () => {
    writeMachineState(dir, { starShown: true, appliedVersion: VERSION });
    expect(readMachineState(dir)).toEqual({ starShown: true, appliedVersion: VERSION });
    writeFileSync(join(dir, MACHINE_STATE_FILE), '{"starShown":false,"appliedVersion":8}');
    expect(readMachineState(dir).unreadable).toBe(true);
  });

  it('reads a file that cannot be read as everything shown, and writes nothing over it', () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, MACHINE_STATE_FILE), '{ not json');
    const read = readMachineState(dir);
    expect(read).toEqual({ starShown: true, unreadable: true });
    writeMachineState(dir, { ...read, starShown: false });
    expect(readFileSync(join(dir, MACHINE_STATE_FILE), 'utf8')).toBe('{ not json');
  });

  it('reads a file whose field has the wrong type as unreadable', () => {
    writeFileSync(join(dir, MACHINE_STATE_FILE), '{"starShown":"yes"}');
    expect(readMachineState(dir).unreadable).toBe(true);
  });
});
