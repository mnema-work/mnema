/**
 * A SINGLE EXECUTABLE WRITES ITSELF ONCE AS THE MERGE DRIVER. In a Node SEA `process.argv[1]` is the name the
 * program was typed with, so `'<exe>' '<exe>' record merge-tail ...` handed the program its own path as a verb
 * and git's merge failed with `mnema has no command "<exe>"`. The four writers of the setting ask one helper,
 * and the doctor reads the one-path form it writes as a driver that can run when that file is executable.
 */

import { describe, expect, it } from 'vitest';
import { whyTheDriverCannotRun } from '../src/commands/doctor-merge-driver.js';
import { driverCommandOf } from '../src/commands/record-pull.js';

describe('the driver command of a process', () => {
  it('names the node and the script when it is a script run by node', () => {
    expect(driverCommandOf('/usr/bin/node', '/opt/mnema/cli.js', false)).toBe(
      "'/usr/bin/node' '/opt/mnema/cli.js' record merge-tail %O %A %B %P",
    );
  });

  it('names the executable once when it is a single executable, whatever argv[1] holds', () => {
    expect(driverCommandOf("/opt/it's/mnema-x", 'mnema-x', true)).toBe(
      "'/opt/it'\\''s/mnema-x' record merge-tail %O %A %B %P",
    );
  });
});

describe('the doctor on a driver of one path', () => {
  it('lets one that names an executable file run', () => {
    const driver = driverCommandOf(process.execPath, 'ignored', true);
    expect(whyTheDriverCannotRun({}, driver)).toBeUndefined();
  });

  it('says which file is not an executable file', () => {
    const driver = driverCommandOf('/nowhere/mnema-x', 'ignored', true);
    expect(whyTheDriverCannotRun({}, driver)).toBe('/nowhere/mnema-x is not an executable file');
  });
});
