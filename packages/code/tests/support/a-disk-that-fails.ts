/**
 * A DISK THAT FAILS ONE CALL, for a test that runs the built binary: a sandbox (a project and a
 * HOME of its own), and a preload that makes the first call it is told to throw an errno.
 *
 * The sandbox is made and removed here, around the test's own use of it, so a test file that
 * only asks what a write says to a failing disk neither makes a directory nor removes one.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Makes the first call `FAIL_AT` names, as `fn:pattern:ERRNO`, throw that errno: the pattern is a
 * regular expression on the path the call is about (a descriptor is mapped to the path it opened).
 * Throws before the call, so no byte of it is written; a sync that is told to fail follows a write
 * that did land. The `node:fs` exports are replaced and the ES module bindings synced.
 */
const PRELOAD = `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const [fn, re, errno] = (process.env.FAIL_AT || '::').split(':');
const pattern = new RegExp(re || '$^');
const paths = new Map();
const open = fs.openSync;
fs.openSync = function (path, ...rest) { const fd = open.call(this, path, ...rest); paths.set(fd, String(path)); return fd; };
let failed = false;
const orig = fs[fn];
if (orig) fs[fn] = function (first, ...rest) {
  const path = typeof first === 'number' ? (paths.get(first) ?? '') : String(first);
  if (!failed && process.env.ARMED === '1' && pattern.test(path)) {
    failed = true;
    const error = new Error(errno + ': injected, ' + fn);
    error.code = errno;
    throw error;
  }
  return orig.call(this, first, ...rest);
};
syncBuiltinESMExports();
`;

/** What a test is handed: where the project is, the HOME of its key, and the preload's file. */
export interface FailingDisk {
  readonly repo: string;
  readonly home: string;
  readonly preload: string;
}

/**
 * Runs `use` over a fresh sandbox and removes it once `use` has settled, whether it returned or
 * threw.
 */
export async function inAFailingDisk<T>(use: (disk: FailingDisk) => T | Promise<T>): Promise<T> {
  const sandbox = mkdtempSync(join(tmpdir(), 'mnema-full-disk-'));
  try {
    const disk = {
      repo: join(sandbox, 'repo'),
      home: join(sandbox, 'home'),
      preload: join(sandbox, 'fail-at.cjs'),
    };
    for (const dir of [disk.repo, disk.home]) mkdirSync(dir, { recursive: true });
    writeFileSync(disk.preload, PRELOAD);
    return await use(disk);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}
