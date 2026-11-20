/**
 * The trace of a call: the line, the byte counts where the kernel keeps them, and which projection
 * refreshes belong to which call.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { observeRefreshes, ProjectionCache } from '@mnema/core';
import { afterEach, describe, expect, it } from 'vitest';
import { formatTraceLine, readIoCounters, startTracing, traceIsOn } from './trace.js';

afterEach(() => observeRefreshes(undefined));

/** A real refresh of a real cache over an empty tree, and the root it will be reported under. */
function aRefresh(): string {
  const root = mkdtempSync(join(tmpdir(), 'mnema-trace-root-'));
  const cache = ProjectionCache.open(root);
  cache.refresh();
  cache.close();
  rmSync(root, { recursive: true, force: true });
  return root;
}

function rootsOf(line: string): string[] {
  const parsed = JSON.parse(line.slice('mnema-trace '.length));
  return parsed.projections.map((each: { root: string }) => each.root);
}

describe('the switch', () => {
  it('is on for 1 and for nothing else', () => {
    expect(traceIsOn({ MNEMA_TRACE: '1' })).toBe(true);
    expect(traceIsOn({ MNEMA_TRACE: 'true' })).toBe(false);
    expect(traceIsOn({ MNEMA_TRACE: '' })).toBe(false);
    expect(traceIsOn({})).toBe(false);
  });
});

describe('the byte counts', () => {
  it('are read from the kernel file, and absent where there is none', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mnema-io-'));
    try {
      const file = join(dir, 'io');
      writeFileSync(file, 'rchar: 1234\nwchar: 56\nsyscr: 1\nread_bytes: 0\n');
      expect(readIoCounters(file)).toEqual({ rchar: 1234, wchar: 56 });
      expect(readIoCounters(join(dir, 'missing'))).toBeUndefined();
      writeFileSync(file, 'nothing of the sort\n');
      expect(readIoCounters(file)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('a traced call', () => {
  const counters = (() => {
    let at = 0;
    return () => {
      at += 1000;
      return { rchar: at, wchar: at / 10 };
    };
  })();

  it('prints one line with its tool, time, byte deltas and the refreshes made during it', async () => {
    const lines: string[] = [];
    const tracer = startTracing((line) => lines.push(line), counters);
    let root = '';
    const reply = await tracer.call('record_observation', async () => {
      root = aRefresh();
      return 'answer';
    });
    expect(reply).toBe('answer');
    expect(lines).toHaveLength(1);
    const [line] = lines as [string];
    expect(line.startsWith('mnema-trace {')).toBe(true);
    const parsed = JSON.parse(line.slice('mnema-trace '.length));
    expect(parsed).toMatchObject({
      door: 'mcp',
      tool: 'record_observation',
      rchar: 1000,
      wchar: 100,
      projections: [{ root, outcome: 'replayed', branch: 'first-read' }],
    });
    expect(typeof parsed.ms).toBe('number');
    tracer.stop();
  });

  it('prints the line when the call throws, and the throw goes on', async () => {
    const lines: string[] = [];
    const tracer = startTracing(
      (line) => lines.push(line),
      () => undefined,
    );
    await expect(
      tracer.call('a_tool', async () => {
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');
    expect(lines).toHaveLength(1);
    // No byte counts where there is no kernel file, and the line is still one.
    const parsed = JSON.parse((lines[0] as string).slice('mnema-trace '.length));
    expect(parsed).not.toHaveProperty('rchar');
    expect(parsed.projections).toEqual([]);
    tracer.stop();
  });

  it('keeps two calls in flight apart', async () => {
    const lines: string[] = [];
    const tracer = startTracing(
      (line) => lines.push(line),
      () => undefined,
    );
    const roots: Record<string, string> = {};
    const slow = tracer.call('slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      roots.slow = aRefresh();
    });
    const quick = tracer.call('quick', async () => {
      roots.quick = aRefresh();
    });
    await Promise.all([slow, quick]);
    const byTool = Object.fromEntries(
      lines.map((line) => [JSON.parse(line.slice('mnema-trace '.length)).tool, rootsOf(line)]),
    );
    expect(byTool).toEqual({ slow: [roots.slow], quick: [roots.quick] });
    tracer.stop();
  });

  it('formats one line', () => {
    expect(formatTraceLine({ door: 'cli', tool: 'status', ms: 1.5, projections: [] })).toBe(
      'mnema-trace {"door":"cli","tool":"status","ms":1.5,"projections":[]}',
    );
  });
});
