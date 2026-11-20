/**
 * The trace of a call: one line on stderr for each tool call of the MCP server (and one for the
 * command line's single call), switched on by `MNEMA_TRACE=1` and off otherwise.
 *
 * It exists to answer one question from outside, with numbers: what does a call cost, and when it
 * costs a replay of the record, WHICH branch of the cache's refresh decided it and which
 * fingerprint or mark it did not find as it had recorded it (`refresh-trace.ts` in the core).
 *
 * A LINE IS `mnema-trace ` AND ONE JSON OBJECT:
 *
 *   door      `mcp` or `cli`
 *   tool      the tool's name, or the command line's verb (never an argument)
 *   ms        wall time of the call, one decimal
 *   rchar     bytes the process asked to read during the call, from `/proc/self/io`; absent where
 *   wchar     bytes it asked to write; absent where there is no `/proc/self/io` (not Linux)
 *   projections  one entry for each projection refreshed during the call: its `root`, its
 *             `outcome` (`unchanged`, `incremental` with `arrived`, `replayed` with `branch` and,
 *             where a fingerprint or mark sent it there, `path`, `expected`, `found`)
 *
 * The byte counts belong to the PROCESS: two calls in flight at once each see the other's bytes.
 * The lines hold paths of this machine, so they are for the person who asked and go nowhere else.
 *
 * OFF IS NOT A CHEAPER ON: no observer is installed, no wrapper is put around a call and
 * `/proc/self/io` is never opened. The core's refresh pays one comparison.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync, writeSync } from 'node:fs';
import { observeRefreshes, type RefreshReport } from '@mnema/core';

/** The variable that turns the trace on: `1`, and nothing else does. */
export const TRACE_VARIABLE = 'MNEMA_TRACE';

/** Whether the environment asks for the trace. */
export function traceIsOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[TRACE_VARIABLE] === '1';
}

/** What the process has read and written so far, by the kernel's count. */
export interface IoCounters {
  readonly rchar: number;
  readonly wchar: number;
}

/** `/proc/self/io`, or undefined where it cannot be read (not Linux, or a sandbox without it). */
export function readIoCounters(file = '/proc/self/io'): IoCounters | undefined {
  try {
    const text = readFileSync(file, 'utf-8');
    const rchar = /^rchar:\s*(\d+)$/m.exec(text)?.[1];
    const wchar = /^wchar:\s*(\d+)$/m.exec(text)?.[1];
    if (rchar === undefined || wchar === undefined) return undefined;
    return { rchar: Number(rchar), wchar: Number(wchar) };
  } catch {
    return undefined;
  }
}

/** One traced call, as printed. */
export interface TraceLine {
  readonly door: 'mcp' | 'cli';
  readonly tool: string;
  readonly ms: number;
  readonly rchar?: number;
  readonly wchar?: number;
  readonly projections: readonly RefreshReport[];
}

/** The text of a line: the prefix a reader greps for, and the object. */
export function formatTraceLine(line: TraceLine): string {
  return `mnema-trace ${JSON.stringify(line)}`;
}

/** A call being measured: finish it for the line. */
export interface OpenCall {
  readonly reports: RefreshReport[];
  finish(): TraceLine;
}

function openCall(
  door: TraceLine['door'],
  tool: string,
  reports: RefreshReport[],
  io: () => IoCounters | undefined,
): OpenCall {
  const started = performance.now();
  const before = io();
  return {
    reports,
    finish(): TraceLine {
      const ms = Math.round((performance.now() - started) * 10) / 10;
      const after = io();
      return {
        door,
        tool,
        ms,
        ...(before !== undefined && after !== undefined
          ? { rchar: after.rchar - before.rchar, wchar: after.wchar - before.wchar }
          : {}),
        projections: reports,
      };
    },
  };
}

/** What the MCP server and the command line hold while the trace is on. */
export interface Tracer {
  /** Runs one MCP call and prints its line when it ends, thrown or not. */
  call<T>(tool: string, run: () => Promise<T>): Promise<T>;
  /** Stops listening. */
  stop(): void;
}

/** Starts the trace for a server: `emit` gets each finished line. `io` is injected for tests. */
export function startTracing(
  emit: (line: string) => void,
  io: () => IoCounters | undefined = readIoCounters,
): Tracer {
  const inCall = new AsyncLocalStorage<RefreshReport[]>();
  observeRefreshes((report) => {
    const reports = inCall.getStore();
    if (reports !== undefined) {
      reports.push(report);
      return;
    }
    // A refresh outside any call (the session opening) is a line of its own.
    emit(
      formatTraceLine({ door: 'mcp', tool: '(outside a call)', ms: 0, projections: [report] }),
    );
  });
  return {
    async call<T>(tool: string, run: () => Promise<T>): Promise<T> {
      const reports: RefreshReport[] = [];
      const call = openCall('mcp', tool, reports, io);
      try {
        return await inCall.run(reports, run);
      } finally {
        emit(formatTraceLine(call.finish()));
      }
    },
    stop: () => observeRefreshes(undefined),
  };
}

/**
 * Traces the command line's one call: begins now and prints the line when the process exits, which is
 * the one moment every way a command ends passes through. The verb is the first word that is not a flag.
 */
export function traceTheCommand(
  argv: readonly string[],
  write: (line: string) => void = (line) => writeSync(2, `${line}\n`),
  io: () => IoCounters | undefined = readIoCounters,
): void {
  const reports: RefreshReport[] = [];
  observeRefreshes((report) => reports.push(report));
  const call = openCall('cli', argv.find((word) => !word.startsWith('-')) ?? '(none)', reports, io);
  process.once('exit', () => {
    try {
      write(formatTraceLine(call.finish()));
    } catch {
      // A trace that cannot be written is not a reason for a command to end differently.
    }
  });
}
