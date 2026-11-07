import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MessageChannel, receiveMessageOnPort, Worker } from 'node:worker_threads';

/**
 * MANY READINGS OF THE SECOND READER IN ONE python3 PROCESS: a seam for the tests, not shipped.
 *
 * Each case of the second-reader suites used to start its own `python3`, which is most of what
 * they cost. `python3` here answers the same question the command line does, but for the two
 * scripts of the verifier it asks one long-lived process (`second-reader-runner.py`) to run the
 * entry the script ends in, and reads the answer back in the same call. `python3Alone` always
 * starts a process of its own; the two are compared case by case in
 * `second-reader-session.test.ts`.
 *
 * The caller is synchronous, so a worker thread holds the child and the caller waits on a
 * shared flag until the worker has posted the answer.
 */

export const VERIFIER_DIR = fileURLToPath(new URL('../../verifier/', import.meta.url));
const RUNNER = fileURLToPath(new URL('./second-reader-runner.py', import.meta.url));
const BATCHED = new Set([join(VERIFIER_DIR, 'mnema_verify.py'), join(VERIFIER_DIR, 'mutate.py')]);

export interface PythonRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
}

const WAIT_MS = 120_000;

const WORKER = `
const { workerData, parentPort } = require('node:worker_threads');
const { spawn } = require('node:child_process');
const { port, flag, runner, verifier } = workerData;
const flagView = new Int32Array(flag);
const child = spawn('python3', [runner, verifier], { stdio: ['pipe', 'pipe', 'pipe'] });
let buffered = '';
let stderr = '';
let asked = 0;
const reply = (message) => {
  asked = 0;
  port.postMessage(message);
  Atomics.store(flagView, 0, 1);
  Atomics.notify(flagView, 0);
};
child.on('error', (error) => reply({ error: error.message }));
child.stderr.on('data', (chunk) => { stderr += chunk; });
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  buffered += chunk;
  let at;
  while ((at = buffered.indexOf('\\n')) !== -1) {
    const line = buffered.slice(0, at);
    buffered = buffered.slice(at + 1);
    reply({ answer: JSON.parse(line) });
  }
});
child.on('close', () => { if (asked > 0) reply({ error: 'the runner ended: ' + stderr }); });
parentPort.on('message', (request) => {
  if (request === 'close') { child.stdin.end(); return; }
  asked = 1;
  child.stdin.write(JSON.stringify(request) + '\\n');
});
`;

interface Session {
  readonly worker: Worker;
  readonly flag: Int32Array;
  readonly port: MessageChannel['port1'];
}

let session: Session | undefined;

function open(): Session {
  const channel = new MessageChannel();
  const shared = new SharedArrayBuffer(4);
  const worker = new Worker(WORKER, {
    eval: true,
    workerData: { port: channel.port2, flag: shared, runner: RUNNER, verifier: VERIFIER_DIR },
    transferList: [channel.port2],
  });
  worker.unref();
  channel.port1.unref();
  return { worker, flag: new Int32Array(shared), port: channel.port1 };
}

/** End the long-lived process; the next batched call starts a new one. */
export function closeSecondReaderSession(): void {
  if (session === undefined) return;
  session.worker.postMessage('close');
  void session.worker.terminate();
  session = undefined;
}

function batched(args: readonly string[]): PythonRun {
  session ??= open();
  Atomics.store(session.flag, 0, 0);
  session.worker.postMessage({ argv: args });
  if (Atomics.wait(session.flag, 0, 0, WAIT_MS) === 'timed-out') {
    closeSecondReaderSession();
    throw new Error(`the second reader gave no answer in ${WAIT_MS} ms`);
  }
  const got = receiveMessageOnPort(session.port)?.message as
    | { answer?: { status: number; stdout: string; stderr: string }; error?: string }
    | undefined;
  if (got?.answer === undefined) {
    closeSecondReaderSession();
    return { status: null, stdout: '', stderr: '', error: new Error(got?.error ?? 'no answer') };
  }
  return got.answer;
}

/** A `python3` of its own, the way the command line starts one. */
export function python3Alone(args: readonly string[], stdin?: string): PythonRun {
  return spawnSync('python3', args, { encoding: 'utf-8', input: stdin });
}

/** The same answer as `python3Alone`; the verifier's two scripts are asked of the long-lived process. */
export function python3(args: readonly string[], stdin?: string): PythonRun {
  const script = args[0];
  if (stdin !== undefined || script === undefined || !BATCHED.has(script)) {
    return python3Alone(args, stdin);
  }
  return batched(args);
}
