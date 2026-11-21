import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MNEMA_CLI } from './the-cli.js';

/**
 * The built binary with its two streams MERGED in the order they were written: both are given the
 * same file descriptor, so the file keeps the order. The merged text comes back as `stdout`, and
 * `stderr` is empty.
 */
export function runMerged(
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    input?: string | undefined;
    timeout?: number | undefined;
  },
) {
  const folder = mkdtempSync(join(tmpdir(), 'mnema-merged-'));
  const file = join(folder, 'out');
  const fd = openSync(file, 'w');
  try {
    const ran = spawnSync(process.execPath, [MNEMA_CLI, ...args], {
      cwd: options.cwd,
      env: options.env,
      input: options.input,
      timeout: options.timeout,
      stdio: [options.input === undefined ? 'ignore' : 'pipe', fd, fd],
    });
    closeSync(fd);
    return {
      status: ran.status,
      signal: ran.signal,
      error: ran.error,
      stdout: readFileSync(file, 'utf-8'),
      stderr: '',
    };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
