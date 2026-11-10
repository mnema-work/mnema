/**
 * THE FSYNC PROBE SAYS HOW LONG THE DISK TOOK AND WHEN, and says nothing when it measured nothing.
 *
 * It runs beside the suite in CI to settle whether the stalls that stop a quick case for seconds
 * are the disk. Its numbers are only worth reading if the percentiles are the ones they say and
 * the instants are kept, so both are pinned on values worked by hand.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  percentile,
  readArgs,
  render,
  summarize,
} from '../../../.github/the-disk-answers/fsync-probe.mjs';

const PROBE = fileURLToPath(
  new URL('../../../.github/the-disk-answers/fsync-probe.mjs', import.meta.url),
);

describe('what the probe says of its samples', () => {
  it('takes the nearest rank, and the worst is the largest', () => {
    const ms = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(percentile(ms, 50)).toBe(50);
    expect(percentile(ms, 99)).toBe(99);
    expect(percentile([], 50)).toBe(0);
    const said = summarize([
      { at: 10, ms: 1 },
      { at: 20, ms: 9000 },
      { at: 30, ms: 2 },
    ]);
    expect(said).toMatchObject({ count: 3, p50: 2, max: 9000 });
    expect(said.worst[0]).toEqual({ at: 20, ms: 9000 });
  });

  it('writes the worst instants into the page, and says it measured nothing when it did not', () => {
    const page = render(summarize([{ at: 1700000000123, ms: 7.5 }]), '/tmp');
    expect(page).toContain('1 samples');
    expect(page).toContain('| 1 | 1700000000123 | 7.5 ms |');
    expect(render(summarize([]), '/tmp')).toContain('took no sample');
  });

  it('refuses an argument it does not know, and a probe that writes nowhere', () => {
    expect(() => readArgs(['--out', 'x', '--nope', '1'])).toThrow('unknown argument');
    expect(() => readArgs(['--every', '250'])).toThrow('--out');
    expect(() => readArgs(['--out', 'x', '--every', '0'])).toThrow('positive');
  });
});

describe('the probe as a process', () => {
  it('samples until it is stopped, then writes what it took', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'probe-case-'));
    const out = join(dir, 'probe.json');
    try {
      const child = spawn(process.execPath, [PROBE, '--every', '20', '--out', out], {
        stdio: 'ignore',
      });
      const closed = new Promise((resolve) => child.on('close', resolve));
      await new Promise((resolve) => setTimeout(resolve, 600));
      child.kill('SIGTERM');
      expect(await closed).toBe(0);
      const written = JSON.parse(readFileSync(out, 'utf-8'));
      expect(written.count).toBeGreaterThan(3);
      expect(written.max).toBeGreaterThanOrEqual(written.p50);
      expect(written.worst[0].at).toBeGreaterThan(1_700_000_000_000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
