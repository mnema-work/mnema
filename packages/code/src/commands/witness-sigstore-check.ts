/**
 * `mnema witness sigstore-check`: is the Sigstore countersignature of this record's checkpoints the
 * one a third party EXPECTS, checked offline, the way `cosign verify-blob` checks it.
 *
 * WHAT IS SIGNED. The message of a Sigstore bundle in `witness/<checkpoint>.sigstore.json` is the
 * checkpoint's own signed message (`checkpointMessage`: the canonical bytes of its fields without
 * the record's signature), whose SHA-256 is the name the bundle is filed under. It is a message
 * signature (bundle v0.3), so the blob `cosign verify-blob` wants is those bytes, and this verb
 * can write them to a folder (`--message-dir`) and print the exact command beside each one.
 *
 * THE CHECKS ARE THE SAME ONES `verify --against-sigstore` runs (`sigstore/read.ts`, Sigstore's own
 * library against the trust root this binary carries), plus the one a third party came for: the
 * certificate must name EXACTLY the identity and the issuer they were told to expect, as
 * `--certificate-identity` and `--certificate-oidc-issuer` do for cosign. A bundle that holds and
 * names somebody else is said by name, and so is one that does not hold.
 *
 * WHAT IS OFFLINE. Everything this verb does: the certificate chain, the certificate-transparency
 * timestamp, Rekor's signed promise and its proof of inclusion are all inside the bundle and are
 * checked against the root carried here. What it does not do is ask anybody whether the root it
 * carries is still current, and whether Rekor still holds the entry: a certificate from a root
 * Sigstore rotated after this binary was built reads `refused`. The verdict of `verify` is not
 * touched; this has an exit of its own: nonzero unless every bundle holds and names who was expected.
 */

import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  statSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import {
  type ChainLayout,
  checkpointHash,
  checkpointMessage,
  readTailCheckpoints,
  witnessSigstorePath,
} from '@mnema/chain';
import type { Scope } from '@mnema/core';
import type { TreeReport } from './verify.js';
import type { SigstoreFinding } from './verify-sigstore.js';
import { readSigstoreReceipts } from './verify-sigstore.js';

/** Who the third party expects the certificate to name: cosign's two flags, taken whole, never as a pattern. */
export interface ExpectedSigner {
  readonly identity: string;
  readonly issuer: string;
}

/** What one bundle came to. */
export type WitnessCheckVerdict =
  /** It holds, and the certificate names the identity and the issuer that were expected. */
  | { readonly kind: 'holds' }
  /** It holds, and the certificate names somebody else. */
  | { readonly kind: 'other-signer'; readonly identity: string; readonly issuer: string }
  /** It does not hold. */
  | { readonly kind: 'refused'; readonly why: string };

/** One bundle: what it came to, and where to hand it to cosign. */
export interface WitnessCheckRow {
  readonly scope: Scope;
  readonly tail: string;
  readonly checkpoint: string;
  readonly verdict: WitnessCheckVerdict;
  readonly finding: SigstoreFinding;
  /** The bundle file. */
  readonly bundle: string;
  /** The file holding the signed message, when `messageDir` was given. */
  readonly message?: string;
  /** The command that checks the same file with cosign, when the message was written. */
  readonly cosign?: string;
}

/** The answer: the bundles, the trees left out, and whether a third party can take it as a yes. */
export interface WitnessCheck {
  readonly bundles: readonly WitnessCheckRow[];
  readonly notRead: readonly Scope[];
  /** Why a message could not be written, or the expectation was empty: each one fails the check. */
  readonly refusals: readonly string[];
  /** True only when there is at least one bundle, every one holds and names who was expected, and no tree was left out. */
  readonly ok: boolean;
}

/** Quotes one word for a POSIX shell. */
function shellWord(word: string): string {
  return /^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;
}

/** The command `cosign` takes for this bundle, message file and expectation, as one line. */
export function cosignCommand(bundle: string, message: string, expected: ExpectedSigner): string {
  return [
    'cosign verify-blob',
    '--bundle',
    shellWord(bundle),
    '--certificate-identity',
    shellWord(expected.identity),
    '--certificate-oidc-issuer',
    shellWord(expected.issuer),
    shellWord(message),
  ].join(' ');
}

/** The message a finding's bundle is over, recomputed from the checkpoints of its tail. */
function messageOf(tree: TreeReport | undefined, finding: SigstoreFinding): Uint8Array | undefined {
  if (tree === undefined || tree.kind !== 'verdict') return undefined;
  const layout: ChainLayout = { root: tree.root };
  const found = readTailCheckpoints(layout, finding.tail).find(
    (checkpoint) => checkpointHash(checkpoint) === finding.checkpoint,
  );
  return found === undefined ? undefined : checkpointMessage(found);
}

/** The signer a reading names equals what was expected: a missing name (read as '') equals nothing. */
export function namesTheExpected(
  reading: { readonly identity: string; readonly issuer: string },
  expected: ExpectedSigner,
): boolean {
  return (
    reading.identity !== '' &&
    reading.issuer !== '' &&
    reading.identity === expected.identity &&
    reading.issuer === expected.issuer
  );
}

/** Whether this machine's file system folds case, so `.MNEMA` is `.mnema`: darwin and win32. */
const FOLDS_CASE = process.platform === 'darwin' || process.platform === 'win32';

/**
 * Where the messages will go, or why they will not: a REAL path, taken from the deepest folder of
 * `dir` that exists (a link among the ancestors, a system temp folder or a linked home, is followed
 * and accepted) with the folders still to make appended. The given path itself may not be a symbolic
 * link, and the real path may not lie in a record: any `.mnema` or `.git` folder (case folded where the
 * file system folds it) or the root of a verified tree (itself taken to its real path). Nothing is made
 * here: the folders are created only after every check has passed.
 */
function whereTheMessagesGo(
  dir: string,
  trees: readonly TreeReport[],
  foldsCase: boolean,
): { readonly ok: true; readonly real: string } | { readonly ok: false; readonly why: string } {
  const fold = (path: string): string => (foldsCase ? path.toLowerCase() : path);
  const given = resolve(dir);
  const own = lstatSync(given, { throwIfNoEntry: false });
  if (own?.isSymbolicLink()) {
    return { ok: false, why: `${given} is a symbolic link: name the folder it points to instead` };
  }
  const rest: string[] = [];
  let existing = given;
  while (lstatSync(existing, { throwIfNoEntry: false }) === undefined) {
    rest.unshift(basename(existing));
    const up = dirname(existing);
    if (up === existing) break;
    existing = up;
  }
  if (!statSync(existing).isDirectory()) return { ok: false, why: `${existing} is not a folder` };
  const real = join(realpathSync(existing), ...rest);
  if (real.split(sep).some((part) => ['.mnema', '.git'].includes(fold(part)))) {
    return { ok: false, why: `${real} is inside a record folder (.mnema or .git): pick another` };
  }
  for (const tree of trees) {
    if (tree.kind !== 'verdict') continue;
    const root = fold(existsSync(tree.root) ? realpathSync(tree.root) : resolve(tree.root));
    const at = fold(real);
    if (at === root || at.startsWith(root + sep)) {
      return { ok: false, why: `${real} is inside the record at ${root}: pick another` };
    }
  }
  return { ok: true, real };
}

/** Writes one message as a new regular file: never through a link, never over a file already there. */
function writeNewFile(file: string, bytes: Uint8Array): string | undefined {
  try {
    const fd = openSync(
      file,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o644,
    );
    try {
      writeSync(fd, bytes);
    } finally {
      closeSync(fd);
    }
    return undefined;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'EEXIST' || code === 'ELOOP'
      ? `${file} already exists: it is never overwritten, remove it or pick another folder`
      : `${file} could not be written: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Checks every Sigstore bundle of the trees that verified against `expected`. Offline, and it
 * writes only where asked: each signed message to `options.messageDir`, named by its SHA-256.
 */
export function checkSigstoreWitnesses(
  trees: readonly TreeReport[],
  expected: ExpectedSigner,
  options: {
    readonly messageDir?: string;
    readonly trustedRoot?: unknown;
    /** Whether the file system folds case; the platform's own when not given. */
    readonly foldsCase?: boolean;
  } = {},
): WitnessCheck {
  const receipts = readSigstoreReceipts(
    trees,
    options.trustedRoot === undefined ? {} : { trustedRoot: options.trustedRoot },
  );
  const refusals: string[] = [];
  if (expected.identity === '' || expected.issuer === '') {
    refusals.push('the identity and the issuer to expect may not be empty');
  }
  let messageDir: string | undefined;
  if (options.messageDir !== undefined) {
    const where = whereTheMessagesGo(options.messageDir, trees, options.foldsCase ?? FOLDS_CASE);
    if (where.ok) {
      mkdirSync(where.real, { recursive: true });
      messageDir = where.real;
    } else {
      refusals.push(where.why);
    }
  }
  const bundles = receipts.findings.map((finding): WitnessCheckRow => {
    const tree = trees.find((one) => one.kind === 'verdict' && one.scope === finding.scope);
    const bundle =
      tree?.kind === 'verdict'
        ? resolve(witnessSigstorePath({ root: tree.root }, finding.tail, finding.checkpoint))
        : '';
    const reading = finding.reading;
    const verdict: WitnessCheckVerdict =
      reading.kind === 'not-covered'
        ? { kind: 'refused', why: reading.why }
        : namesTheExpected(reading, expected)
          ? { kind: 'holds' }
          : { kind: 'other-signer', identity: reading.identity, issuer: reading.issuer };
    const at = { scope: finding.scope, tail: finding.tail, checkpoint: finding.checkpoint };
    const message = messageDir === undefined ? undefined : messageOf(tree, finding);
    if (messageDir === undefined || message === undefined) {
      return { ...at, verdict, finding, bundle };
    }
    const file = join(messageDir, `${finding.checkpoint}.message`);
    const failed = writeNewFile(file, message);
    if (failed !== undefined) {
      refusals.push(failed);
      return { ...at, verdict, finding, bundle };
    }
    return {
      ...at,
      verdict,
      finding,
      bundle,
      message: file,
      cosign: cosignCommand(bundle, file, expected),
    };
  });
  const ok =
    bundles.length > 0 &&
    refusals.length === 0 &&
    receipts.notRead.length === 0 &&
    bundles.every((row) => row.verdict.kind === 'holds');
  return { bundles, notRead: receipts.notRead, refusals, ok };
}
