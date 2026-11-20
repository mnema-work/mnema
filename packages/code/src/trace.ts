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
import { existsSync, readFileSync, writeSync } from 'node:fs';
import { observeRefreshes, type RefreshReport, spillRefusal, type WalCut } from '@mnema/core';

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

/**
 * `/proc/self/io`, or undefined where there is none (not Linux) or it says nothing this reads.
 * A file that is there and cannot be read THROWS: what the call is traced as says why
 * (`ioUnavailable`), instead of two numbers going missing with no reason.
 */
export function readIoCounters(file = '/proc/self/io'): IoCounters | undefined {
  if (!existsSync(file)) return undefined;
  const text = readFileSync(file, 'utf-8');
  const rchar = /^rchar:\s*(\d+)$/m.exec(text)?.[1];
  const wchar = /^wchar:\s*(\d+)$/m.exec(text)?.[1];
  if (rchar === undefined || wchar === undefined) return undefined;
  return { rchar: Number(rchar), wchar: Number(wchar) };
}

/** The tool a line about the idle cut of the logs is filed under. */
export const IDLE_CHECKPOINT_TOOL = '(idle checkpoint)';

/** What one reading of the counters gave: the numbers, or why there are none. */
function measured(io: () => IoCounters | undefined): {
  readonly counters?: IoCounters;
  readonly why?: string;
} {
  try {
    const counters = io();
    return counters === undefined ? {} : { counters };
  } catch (error) {
    return { why: error instanceof Error ? error.message : String(error) };
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
  /** Why the byte counts are missing, where the kernel file is there and could not be read. */
  readonly ioUnavailable?: string;
  /** Why SQLite's temporary files were not pointed beside the cache, when that was refused. */
  readonly spillRefused?: string;
  /** What an idle cut of each cache's log came to: the root, whether it was cut and, if not, why. */
  readonly wal?: readonly ({ readonly root: string } & WalCut)[];
  /** What an idle cut that threw was. */
  readonly failed?: string;
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
  const before = measured(io);
  return {
    reports,
    finish(): TraceLine {
      const ms = Math.round((performance.now() - started) * 10) / 10;
      const after = measured(io);
      const why = before.why ?? after.why;
      const refused = spillRefusal();
      return {
        door,
        tool,
        ms,
        ...(before.counters !== undefined && after.counters !== undefined
          ? {
              rchar: after.counters.rchar - before.counters.rchar,
              wchar: after.counters.wchar - before.counters.wchar,
            }
          : {}),
        projections: reports,
        ...(why !== undefined ? { ioUnavailable: why } : {}),
        ...(refused !== undefined ? { spillRefused: refused } : {}),
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
    emit(formatTraceLine({ door: 'mcp', tool: '(outside a call)', ms: 0, projections: [report] }));
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
    } catch (error) {
      // A reader that closed the pipe has stopped asking for the trace, and a command does not end
      // differently for it; any other failure to write it is not hidden.
      if ((error as NodeJS.ErrnoException).code !== 'EPIPE') throw error;
    }
  });
}
