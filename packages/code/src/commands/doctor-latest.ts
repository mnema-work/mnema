/**
 * `mnema doctor --latest`: the one place this product asks the npm registry which version is the
 * newest, and only because a person (or the agent holding their shell) TYPED the verb.
 *
 * WHAT IS ASKED. Two public GETs to one fixed host, `registry.npmjs.org`, with the package name in
 * the path and nothing else: the version document (`/latest`, about 3 KB) and, only when that is
 * newer than the running version, the attestations of that version (about 15 KB). No header of
 * ours, no `.npmrc`, no mirror, no project, no path, no identity, and never the running version.
 * Each request has a deadline (5 s, body included), a byte cap, `redirect: 'error'`, and a URL
 * composed here from a version that passed `^\d+\.\d+\.\d+$`. Nothing is written: not the record,
 * not a cache, not a file.
 *
 * WHAT IS SAID. Only text composed here, from values that passed a check; nothing the registry
 * wrote is printed. A version is NAMED AS ONE TO INSTALL (with its command) only after its npm
 * provenance verifies offline against the trust root this binary carries and the four comparisons
 * of `sigstore/read-provenance.ts` hold, AND two days have passed since its signed publication
 * time. A version without attested provenance is said to exist and nothing more: no command.
 * Every sentence is what npm.org LISTS: never that the person's own registry serves it.
 */

import { realpathSync } from 'node:fs';
import { acceptedBy, floorRefusal } from '../node-floor.js';
import { isOlderThan } from '../version.js';

/** The host asked. Fixed: there is no variable, setting or file that changes it. */
export const REGISTRY = 'https://registry.npmjs.org';

/** How long one request may take to answer, body included. */
export const DEADLINE_MS = 5_000;

/** The most bytes an answer of the version document may weigh. */
export const VERSION_DOCUMENT_BYTES = 16 * 1024;

/** The most bytes an answer of the attestations endpoint may weigh. */
export const ATTESTATIONS_BYTES = 64 * 1024;

/** Days after the signed publication before a version is named as one to install. */
export const COOLDOWN_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The `fetch` this module asks through; a test hands its own, so no case reaches a network. */
export type Fetch = (
  url: string,
  init: { readonly redirect: 'error'; readonly signal: AbortSignal },
) => Promise<Response>;

const platformFetch: Fetch = (url, init) => globalThis.fetch(url, init);

/** Why an answer could not be had, in words composed here. */
type Unasked =
  | 'no answer within 5 s'
  | 'the connection failed'
  | 'npm answered with an error status'
  | 'the answer was larger than the bound'
  | 'the answer was not what was asked for';

class Unanswered extends Error {
  constructor(readonly said: Unasked) {
    super(said);
  }
}

/**
 * One GET, bounded: the deadline covers the connection, the headers and the body, the bytes read
 * are counted as they arrive (a declared length is only believed to refuse early), and a redirect
 * is an error. Resolves to the status and the text, or throws {@link Unanswered}.
 */
async function ask(
  fetchIt: Fetch,
  url: string,
  cap: number,
): Promise<{ readonly status: number; readonly text: string }> {
  const controller = new AbortController();
  const gone = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      'abort',
      () => reject(new Unanswered('no answer within 5 s')),
      {
        once: true,
      },
    );
  });
  gone.catch(() => undefined);
  const timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    const response = await Promise.race([
      fetchIt(url, { redirect: 'error', signal: controller.signal }),
      gone,
    ]);
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > cap) {
      await response.body?.cancel().catch(() => undefined);
      throw new Unanswered('the answer was larger than the bound');
    }
    const chunks: Buffer[] = [];
    let total = 0;
    if (response.body !== null) {
      const reader = response.body.getReader();
      for (;;) {
        const next = await Promise.race([reader.read(), gone]);
        if (next.done) break;
        total += next.value.byteLength;
        if (total > cap) {
          await reader.cancel().catch(() => undefined);
          throw new Unanswered('the answer was larger than the bound');
        }
        chunks.push(Buffer.from(next.value));
      }
    }
    return { status: response.status, text: Buffer.concat(chunks).toString('utf-8') };
  } catch (error) {
    if (error instanceof Unanswered) throw error;
    throw new Unanswered('the connection failed');
  } finally {
    clearTimeout(timer);
  }
}

/** What the version document says, once checked: a strict version and the digest and Node range it carries. */
interface Listed {
  readonly version: string;
  readonly integrity: string;
  readonly node: string | undefined;
}

function readListed(text: string): Listed {
  let document: {
    name?: unknown;
    version?: unknown;
    dist?: { integrity?: unknown };
    engines?: { node?: unknown };
  };
  try {
    document = JSON.parse(text) as typeof document;
  } catch {
    throw new Unanswered('the answer was not what was asked for');
  }
  const { version, dist, engines } = document;
  if (
    document.name !== '@mnema/code' ||
    typeof version !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    typeof dist?.integrity !== 'string' ||
    !/^sha512-[A-Za-z0-9+/]{86}==$/.test(dist.integrity)
  ) {
    throw new Unanswered('the answer was not what was asked for');
  }
  return {
    version,
    integrity: dist.integrity,
    node: typeof engines?.node === 'string' ? engines.node : undefined,
  };
}

/** Where this binary was installed from, as far as its own real path tells. */
export interface InstalledFrom {
  /** The real path of the running file (`process.argv[1]`, resolved). */
  readonly file: string;
  /** The path of the running `node` executable. */
  readonly node: string;
}

/** What a path may hold to be composed into a command: no space, quote, `$`, backtick, `;`, `&` or `|`. */
/** Where the running file really is: its real path where that can be resolved, as given where it cannot. */
export function installedFrom(file: string, node: string): InstalledFrom {
  try {
    return { file: realpathSync(file), node };
  } catch {
    return { file, node };
  }
}

const SAFE_PATH = /^[A-Za-z0-9_./~-]+$/;
/** What the running file's path may hold to be read at all: the layouts themselves carry `@` and `+`. */
const READABLE_PATH = /^[A-Za-z0-9_./~@+-]+$/;
const NPM_LAYOUT = /^(.*)\/lib\/node_modules\/@mnema\/code\/dist\/bundle\/cli\.js$/;

/**
 * The command that installs exactly `version` the way this binary was installed, or undefined
 * where that cannot be told. A string test on the real path of the running file: no `npm` is
 * spawned, a path with a character outside the safe set is never composed into a command, and
 * yarn, bun, Volta, mise, Homebrew, `npx` and Windows layouts match nothing.
 */
export function installCommand(from: InstalledFrom, version: string): string | undefined {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !READABLE_PATH.test(from.file)) return undefined;
  if (from.file.split('/').includes('.pnpm')) return `pnpm add -g @mnema/code@${version}`;
  const prefix = NPM_LAYOUT.exec(from.file)?.[1];
  if (prefix === undefined || prefix === '') return undefined;
  const byDefault = from.node.replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
  if (prefix === byDefault) return `npm i -g @mnema/code@${version}`;
  return SAFE_PATH.test(prefix) ? `npm i -g --prefix ${prefix} @mnema/code@${version}` : undefined;
}

/** What the asking found, before it is put in words. */
export type Latest =
  | { readonly kind: 'unasked'; readonly why: Unasked }
  | { readonly kind: 'current'; readonly listed: string }
  | { readonly kind: 'without-provenance'; readonly listed: string }
  | { readonly kind: 'provenance-refused'; readonly listed: string; readonly comparison: string }
  | {
      readonly kind: 'cooling';
      readonly listed: string;
      readonly loggedAt: string;
      readonly until: string;
    }
  | { readonly kind: 'needs-another-node'; readonly listed: string; readonly said: string }
  | {
      readonly kind: 'verified';
      readonly listed: string;
      readonly loggedAt: string;
      readonly commit: string | undefined;
      readonly command: string | undefined;
    };

/** Asks the registry (the two GETs above) and judges the answer. Never throws. */
export async function askTheRegistry(options: {
  readonly running: string;
  readonly node: string;
  readonly from: InstalledFrom;
  readonly now: Date;
  readonly fetch?: Fetch;
}): Promise<Latest> {
  const fetchIt = options.fetch ?? platformFetch;
  try {
    const first = await ask(fetchIt, `${REGISTRY}/@mnema%2fcode/latest`, VERSION_DOCUMENT_BYTES);
    if (first.status !== 200) throw new Unanswered('npm answered with an error status');
    const listed = readListed(first.text);
    if (!isOlderThan(options.running, listed.version))
      return { kind: 'current', listed: listed.version };

    const second = await ask(
      fetchIt,
      `${REGISTRY}/-/npm/v1/attestations/@mnema%2fcode@${listed.version}`,
      ATTESTATIONS_BYTES,
    );
    if (second.status === 404) return { kind: 'without-provenance', listed: listed.version };
    if (second.status !== 200) throw new Unanswered('npm answered with an error status');
    const { readProvenance } = await import('../sigstore/read-provenance.js');
    const reading = readProvenance(second.text, {
      version: listed.version,
      integrity: listed.integrity,
    });
    if (reading.kind === 'refused') {
      return reading.refusal === 'no-provenance'
        ? { kind: 'without-provenance', listed: listed.version }
        : { kind: 'provenance-refused', listed: listed.version, comparison: reading.refusal };
    }
    const until = new Date(Date.parse(reading.loggedAt) + COOLDOWN_DAYS * DAY_MS);
    if (options.now.getTime() < until.getTime()) {
      return {
        kind: 'cooling',
        listed: listed.version,
        loggedAt: reading.loggedAt,
        until: until.toISOString(),
      };
    }
    const accepted = listed.node === undefined ? undefined : acceptedBy(listed.node);
    if (accepted === undefined || floorRefusal(options.node, listed.node ?? '') !== undefined) {
      return {
        kind: 'needs-another-node',
        listed: listed.version,
        said:
          accepted === undefined
            ? 'a Node range this cannot read'
            : `Node ${accepted.map((a) => a.said).join(', or ')}`,
      };
    }
    return {
      kind: 'verified',
      listed: listed.version,
      loggedAt: reading.loggedAt,
      commit: reading.commit,
      command: installCommand(options.from, listed.version),
    };
  } catch (error) {
    return {
      kind: 'unasked',
      why: error instanceof Unanswered ? error.said : 'the connection failed',
    };
  }
}

const HOW_TO_CHECK =
  'docs/install.md says how to check a version by hand (“Where the package came from”).';
const DECIDES =
  'A person decides whether to install it; an agent does not update on its own. This reports what npm.org lists, never what your own registry serves.';

/** The lines `doctor --latest` prints for what was found: composed here, never from the registry's text. */
export function sayLatest(found: Latest, running: string, now: Date): readonly string[] {
  switch (found.kind) {
    case 'unasked':
      return [
        `npm.org could not be asked (${found.why}): nothing was learned and nothing was kept.`,
      ];
    case 'current':
      return [
        `npm lists @mnema/code ${found.listed} as the latest and this is ${running}: nothing newer is listed. This reports what npm.org lists, never what your own registry serves.`,
      ];
    case 'without-provenance':
      return [
        `npm lists @mnema/code ${found.listed}, newer than ${running}, WITHOUT attested provenance: nothing ties it to this project's release workflow, so no command is given. ${HOW_TO_CHECK}`,
      ];
    case 'provenance-refused':
      return [
        `npm lists @mnema/code ${found.listed}, newer than ${running}, but its provenance did not hold (${found.comparison}): no command is given. ${HOW_TO_CHECK}`,
      ];
    case 'cooling':
      return [
        `npm lists @mnema/code ${found.listed}, newer than ${running}, built by this project's release workflow and signed into the public log at ${found.loggedAt}. It is named as one to install ${COOLDOWN_DAYS} days after that time: ask again after ${found.until}. No command is given yet. ${DECIDES}`,
      ];
    case 'needs-another-node':
      return [
        `npm lists @mnema/code ${found.listed}, newer than ${running}, built by this project's release workflow, and it needs ${found.said}: no command is given.`,
      ];
    case 'verified': {
      const signed = Date.parse(found.loggedAt);
      const age = Math.max(0, Math.floor((Number(now) - signed) / DAY_MS));
      const lines = [
        `npm lists @mnema/code ${found.listed}, newer than ${running}: built by this project's release workflow, signed into the public log at ${found.loggedAt} (${age} days ago).${found.commit === undefined ? '' : ` Commit ${found.commit}; compare it with \`git ls-remote --tags https://github.com/mnema-work/mnema v${found.listed}\`.`}`,
        found.command === undefined
          ? 'This was installed some other way: docs/install.md says how.'
          : `To install exactly that version: ${found.command}`,
        `Then run \`mnema upgrade\` in each project. ${DECIDES}`,
      ];
      if (found.command?.startsWith('npm i -g --prefix') === true) {
        lines.push('If you run the main branch from a clone, pull it and build again instead.');
      }
      return lines;
    }
  }
}
