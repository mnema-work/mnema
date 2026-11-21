/**
 * `mnema witness sigstore-check`, offline: a countersignature made by a Sigstore of the test's own
 * (`tests/support/a-sigstore-of-our-own.ts`) over a real checkpoint, read back against the trust
 * root that reaches it. Nothing here touches the network.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  checkpointHash,
  checkpointMessage,
  readTailCheckpoints,
  witnessSigstorePath,
} from '@mnema/chain';
import type { DiscoveryEnv } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ACTIONS_ISSUER,
  AUTHOR_WORKFLOW,
  aSigstoreOfOurOwn,
} from '../../tests/support/a-sigstore-of-our-own.js';
import { type CliIo, run } from '../program.js';
import { runInit } from './init.js';
import { runMemory } from './memory.js';
import { runVerify } from './verify.js';
import {
  checkSigstoreWitnesses,
  cosignCommand,
  namesTheExpected,
} from './witness-sigstore-check.js';

describe('checking a Sigstore countersignature against who was expected', () => {
  let sandbox: string;
  let cwd: string;
  let env: DiscoveryEnv;
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'mnema-sigcheck-'));
    cwd = join(sandbox, 'repo');
    mkdirSync(cwd, { recursive: true });
    env = { home: join(sandbox, 'home') };
    runInit({ cwd, env });
    runMemory({ cwd, env }, { content: 'a fact worth keeping' });
  });
  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  const trees = () => {
    const done = runVerify({ cwd, env, requirement: 'chained', global: false });
    if (!done.ok) throw new Error('setup: no project');
    return done.trees;
  };

  /** Countersigns the head of the one tail as `identity`, filing the bundle where `witness sigstore` does. */
  async function countersigned(identity = AUTHOR_WORKFLOW) {
    const sigstore = await aSigstoreOfOurOwn();
    const root = join(cwd, '.mnema');
    const tail = readdirSync(join(root, 'tails'))[0] as string;
    const head = readTailCheckpoints({ root }, tail).at(-1);
    if (head === undefined) throw new Error('setup: no checkpoint');
    const bundle = await sigstore.sign(checkpointMessage(head), checkpointHash(head), identity);
    const file = witnessSigstorePath({ root }, tail, checkpointHash(head));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(bundle));
    return { sigstore, file, hash: checkpointHash(head), message: checkpointMessage(head) };
  }

  const expected = { identity: AUTHOR_WORKFLOW, issuer: ACTIONS_ISSUER };

  it('holds when the certificate names the expected identity and issuer', async () => {
    const { sigstore, hash } = await countersigned();
    const check = checkSigstoreWitnesses(trees(), expected, { trustedRoot: sigstore.trustedRoot });
    expect(check.ok).toBe(true);
    expect(check.bundles).toHaveLength(1);
    expect(check.bundles[0]).toMatchObject({ checkpoint: hash, verdict: { kind: 'holds' } });
  });

  it('refuses a certificate that names somebody else, and says who', async () => {
    const { sigstore } = await countersigned(
      'https://github.com/other/repo/.github/workflows/x.yml@refs/heads/main',
    );
    const check = checkSigstoreWitnesses(trees(), expected, { trustedRoot: sigstore.trustedRoot });
    expect(check.ok).toBe(false);
    expect(check.bundles[0]?.verdict).toEqual({
      kind: 'other-signer',
      identity: 'https://github.com/other/repo/.github/workflows/x.yml@refs/heads/main',
      issuer: ACTIONS_ISSUER,
    });
    // The right identity under another issuer is another signer too: both halves are exact.
    const issuer = checkSigstoreWitnesses(
      trees(),
      { identity: AUTHOR_WORKFLOW, issuer: 'https://accounts.example' },
      { trustedRoot: sigstore.trustedRoot },
    );
    expect(issuer.ok).toBe(false);
    expect(issuer.bundles[0]?.verdict.kind).toBe('other-signer');
  });

  it('refuses a bundle with one byte changed', async () => {
    const { sigstore, file } = await countersigned();
    const text = readFileSync(file, 'utf-8');
    const bundle = JSON.parse(text) as { messageSignature: { signature: string } };
    const signature = Buffer.from(bundle.messageSignature.signature, 'base64');
    signature[signature.length - 1] = (signature[signature.length - 1] ?? 0) ^ 1;
    bundle.messageSignature.signature = signature.toString('base64');
    writeFileSync(file, JSON.stringify(bundle));
    const check = checkSigstoreWitnesses(trees(), expected, { trustedRoot: sigstore.trustedRoot });
    expect(check.ok).toBe(false);
    expect(check.bundles[0]?.verdict.kind).toBe('refused');
  });

  it('refuses a bundle the carried trust root does not reach, which is the public one here', async () => {
    await countersigned();
    const check = checkSigstoreWitnesses(trees(), expected);
    expect(check.ok).toBe(false);
    expect(check.bundles[0]?.verdict.kind).toBe('refused');
  });

  it('says nothing is checked when the record holds no bundle', () => {
    const check = checkSigstoreWitnesses(trees(), expected);
    expect(check).toMatchObject({ ok: false, bundles: [], notRead: [] });
  });

  it('writes the signed message under its SHA-256 and prints the cosign line that checks the same bundle', async () => {
    const { sigstore, file, hash, message } = await countersigned();
    const out = join(sandbox, 'messages');
    const check = checkSigstoreWitnesses(trees(), expected, {
      messageDir: out,
      trustedRoot: sigstore.trustedRoot,
    });
    const written = join(out, `${hash}.message`);
    // The blob cosign hashes is the one the bundle names: its SHA-256 is the checkpoint's hash.
    expect(createHash('sha256').update(readFileSync(written)).digest('hex')).toBe(hash);
    expect(Buffer.compare(readFileSync(written), Buffer.from(message))).toBe(0);
    expect(check.bundles[0]?.cosign).toBe(
      `cosign verify-blob --bundle ${file} --certificate-identity ${AUTHOR_WORKFLOW} ` +
        `--certificate-oidc-issuer ${ACTIONS_ISSUER} ${written}`,
    );
  });

  describe('where the messages go', () => {
    const run = async (dir: string) => {
      const { sigstore, hash } = await countersigned();
      const check = checkSigstoreWitnesses(trees(), expected, {
        messageDir: dir,
        trustedRoot: sigstore.trustedRoot,
      });
      return { check, hash };
    };

    it('refuses a folder that is a symbolic link, and writes nothing through it', async () => {
      const real = join(sandbox, 'real');
      mkdirSync(real);
      const link = join(sandbox, 'link');
      symlinkSync(real, link);
      const { check } = await run(link);
      expect(check.ok).toBe(false);
      expect(check.refusals.join(' ')).toContain('symbolic link');
      expect(readdirSync(real)).toEqual([]);
    });

    it('refuses a folder that passes through a symbolic link', async () => {
      const real = join(sandbox, 'real');
      mkdirSync(real);
      symlinkSync(real, join(sandbox, 'link'));
      const { check } = await run(join(sandbox, 'link', 'inner'));
      expect(check.ok).toBe(false);
      expect(check.refusals.join(' ')).toContain('symbolic link');
      expect(readdirSync(real)).toEqual([]);
    });

    it('does not follow a message file that is a link to somebody else’s file', async () => {
      const { sigstore, hash } = await countersigned();
      const dir = join(sandbox, 'msgs');
      mkdirSync(dir);
      const target = join(sandbox, 'bashrc');
      writeFileSync(target, 'mine');
      symlinkSync(target, join(dir, `${hash}.message`));
      const check = checkSigstoreWitnesses(trees(), expected, {
        messageDir: dir,
        trustedRoot: sigstore.trustedRoot,
      });
      expect(check.ok).toBe(false);
      expect(readFileSync(target, 'utf-8')).toBe('mine');
    });

    it('never overwrites a message file that is already there', async () => {
      const { sigstore, hash } = await countersigned();
      const dir = join(sandbox, 'msgs');
      mkdirSync(dir);
      writeFileSync(join(dir, `${hash}.message`), 'keep me');
      const check = checkSigstoreWitnesses(trees(), expected, {
        messageDir: dir,
        trustedRoot: sigstore.trustedRoot,
      });
      expect(check.ok).toBe(false);
      expect(check.refusals.join(' ')).toContain('already exists');
      expect(readFileSync(join(dir, `${hash}.message`), 'utf-8')).toBe('keep me');
    });

    it('refuses a folder inside the record, and creates nothing there', async () => {
      const inside = join(cwd, '.mnema', 'msgs');
      const { check } = await run(inside);
      expect(check.ok).toBe(false);
      expect(check.refusals.join(' ')).toContain('inside');
      expect(existsSync(inside)).toBe(false);
    });
  });

  it('fails when nothing is expected, and a signer with no name equals nothing', async () => {
    const { sigstore } = await countersigned();
    const check = checkSigstoreWitnesses(
      trees(),
      { identity: '', issuer: '' },
      { trustedRoot: sigstore.trustedRoot },
    );
    expect(check.ok).toBe(false);
    expect(check.refusals.join(' ')).toContain('may not be empty');
    expect(namesTheExpected({ identity: '', issuer: '' }, { identity: '', issuer: '' })).toBe(
      false,
    );
    expect(namesTheExpected({ identity: 'a', issuer: 'b' }, { identity: 'a', issuer: 'b' })).toBe(
      true,
    );
  });

  it('reports a folder named like a bundle as unreadable instead of throwing', async () => {
    const { sigstore, file } = await countersigned();
    rmSync(file);
    mkdirSync(file);
    const check = checkSigstoreWitnesses(trees(), expected, { trustedRoot: sigstore.trustedRoot });
    expect(check.ok).toBe(false);
    expect(check.bundles[0]?.verdict).toMatchObject({ kind: 'refused' });
    expect(JSON.stringify(check.bundles[0]?.verdict)).toContain('cannot be read');
  });

  it('quotes what a shell would split', () => {
    expect(
      cosignCommand('/a b/x.sigstore.json', '/m/y.message', {
        identity: "o'neil@example.com",
        issuer: ACTIONS_ISSUER,
      }),
    ).toBe(
      `cosign verify-blob --bundle '/a b/x.sigstore.json' --certificate-identity 'o'\\''neil@example.com' ` +
        `--certificate-oidc-issuer ${ACTIONS_ISSUER} /m/y.message`,
    );
  });
});

describe('the verb, as typed', () => {
  let sandbox: string;
  let was: string;
  let home: string | undefined;
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'mnema-sigcheck-cli-'));
    mkdirSync(join(sandbox, 'repo'));
    was = process.cwd();
    home = process.env.HOME;
    process.env.HOME = join(sandbox, 'home');
    process.chdir(join(sandbox, 'repo'));
  });
  afterEach(() => {
    process.chdir(was);
    if (home === undefined) delete process.env.HOME;
    else process.env.HOME = home;
    rmSync(sandbox, { recursive: true, force: true });
  });

  async function typed(...argv: string[]) {
    const out: string[] = [];
    const err: string[] = [];
    let failed = false;
    const io: CliIo = {
      out: (line) => out.push(line),
      err: (line) => err.push(line),
      fail: () => {
        failed = true;
      },
    };
    await run(argv, io);
    return { out: out.join('\n'), err: err.join('\n'), failed };
  }

  const args = [
    'witness',
    'sigstore-check',
    '--identity',
    AUTHOR_WORKFLOW,
    '--issuer',
    ACTIONS_ISSUER,
  ];

  it('fails, and says so, over a record with no bundle', async () => {
    await typed('init');
    const answer = await typed(...args);
    expect(answer.failed).toBe(true);
    expect(answer.err).toContain('no Sigstore bundle in this record');
  });

  it('refuses a bundle of a Sigstore this binary does not carry, and still writes the message and prints the cosign line that checks it', async () => {
    await typed('init');
    const root = join(process.cwd(), '.mnema');
    const tail = readdirSync(join(root, 'tails'))[0] as string;
    const head = readTailCheckpoints({ root }, tail).at(-1);
    if (head === undefined) throw new Error('setup: no checkpoint');
    const sigstore = await aSigstoreOfOurOwn();
    const bundle = await sigstore.sign(checkpointMessage(head), checkpointHash(head));
    const file = witnessSigstorePath({ root }, tail, checkpointHash(head));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(bundle));
    const answer = await typed(...args, '--message-dir', join(sandbox, 'm'));
    expect(answer.failed).toBe(true);
    expect(answer.err).toContain('refused it');
    expect(
      readFileSync(join(sandbox, 'm', `${checkpointHash(head)}.message`)).length,
    ).toBeGreaterThan(0);
    expect(answer.out).toContain(`cosign verify-blob --bundle ${file}`);
  });

  it('refuses an empty identity or issuer', async () => {
    await typed('init');
    const answer = await typed(
      'witness',
      'sigstore-check',
      '--identity',
      '',
      '--issuer',
      ACTIONS_ISSUER,
    );
    expect(answer.failed).toBe(true);
    expect(answer.err).toContain('non-empty');
  });

  it('requires both halves of who is expected, as cosign does', async () => {
    const answer = await typed('witness', 'sigstore-check', '--identity', 'x');
    expect(answer.failed).toBe(true);
    expect(answer.err).toContain('--issuer');
  });
});
