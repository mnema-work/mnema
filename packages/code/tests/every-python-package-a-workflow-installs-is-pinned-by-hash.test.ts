// @reads-the-tree
/**
 * EVERY PYTHON PACKAGE A WORKFLOW INSTALLS IS PINNED BY THE HASH OF EACH FILE IT MAY BE.
 *
 * `pip install mypy==1.19.1` names a version, and a version is a name the index can re-point: a
 * file replaced under it is installed all the same, on a runner that holds this repository's
 * checkout. A requirements file whose every line carries `--hash=sha256:...`, installed with
 * `--require-hashes`, makes pip refuse any file whose digest is not written here, and refuse a
 * dependency that is not listed (so the transitive ones are pinned too). That is what the OpenSSF
 * Scorecard's Pinned-Dependencies check reads for `pip`.
 *
 * This reads every workflow git carries and every shell script under `.github`, not the two jobs
 * that install Python tools today: a `pip install` is accepted only as
 * `pip install ... --require-hashes -r <file>` where the file exists, and every requirement in
 * that file has at least one hash.
 *
 * WHAT IT DOES NOT SAY. That the hashes are those of the files the index serves (that needs the
 * network, and `pip` refuses at install time if they are not), nor anything about `npm`: the host
 * contract's `npm install` of a host's own CLI takes a version the matrix chooses at run time and
 * is checked against the vendor's own signature or attestation in the same step.
 *
 * A guard that finds nothing is worth something only if it can find: the last case feeds the
 * reader the shapes that must be refused and asserts the workflows really do install with pip.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const FILES: readonly string[] = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '.github'],
  { cwd: ROOT, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 },
)
  .split('\n')
  .filter((where) => /^\.github\/workflows\/.+\.ya?ml$/.test(where) || /\.sh$/.test(where));

/** One `pip install` with the continuation lines that finish it, as the command it is. */
function pipInstalls(text: string): { line: number; command: string }[] {
  const lines = text.split('\n');
  const found: { line: number; command: string }[] = [];
  for (let at = 0; at < lines.length; at += 1) {
    const raw = lines[at] ?? '';
    if (/^\s*#/.test(raw) || !/\bpip3?["']?\s+install\b/.test(raw)) continue;
    let command = raw;
    let end = at;
    while (/\\\s*$/.test(command) && end + 1 < lines.length) {
      end += 1;
      command = `${command.replace(/\\\s*$/, ' ')}${lines[end] ?? ''}`;
    }
    found.push({ line: at + 1, command });
  }
  return found;
}

/** The requirements file a hashed install reads, or undefined when it is not one. */
function hashedFile(command: string): string | undefined {
  if (!/--require-hashes\b/.test(command)) return undefined;
  return /\s-r\s+(\S+)/.exec(command)?.[1];
}

/** The requirements of a file that no hash follows, by name. */
function withoutHash(text: string): string[] {
  const bare: string[] = [];
  let name: string | undefined;
  let hashed = false;
  const close = () => {
    if (name !== undefined && !hashed) bare.push(name);
  };
  for (const raw of text.split('\n')) {
    const requirement = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*[=<>~!]/.exec(raw);
    if (requirement?.[1] !== undefined) {
      close();
      name = requirement[1];
      hashed = false;
    }
    if (/--hash=sha256:[0-9a-f]{64}/.test(raw)) hashed = true;
  }
  close();
  return bare;
}

/** The installs of the text that are not hashed, as `file:line command`. */
function unhashed(text: string, file: string, exists: (where: string) => boolean): string[] {
  return pipInstalls(text).flatMap(({ line, command }) => {
    const required = hashedFile(command);
    return required === undefined || !exists(required) ? [`${file}:${line} ${command.trim()}`] : [];
  });
}

describe('a Python package a workflow installs', () => {
  it('is installed with --require-hashes from a requirements file that exists', () => {
    const bad = FILES.flatMap((file) =>
      unhashed(readFileSync(join(ROOT, file), 'utf-8'), file, (where) =>
        existsSync(join(ROOT, where)),
      ),
    );
    expect(bad, 'a pip install that is not pinned by the hash of each file').toEqual([]);
  });

  it('is listed with a hash in every requirements file those installs read', () => {
    const files = new Set(
      FILES.flatMap((file) =>
        pipInstalls(readFileSync(join(ROOT, file), 'utf-8')).flatMap(({ command }) => {
          const required = hashedFile(command);
          return required === undefined ? [] : [required];
        }),
      ),
    );
    expect(files.size, 'no workflow installs from a requirements file').toBeGreaterThan(0);
    for (const file of files) {
      expect(
        withoutHash(readFileSync(join(ROOT, file), 'utf-8')),
        `${file} has a bare requirement`,
      ).toEqual([]);
    }
  });

  it('refuses the shapes it is for', () => {
    const yes = () => true;
    expect(unhashed('run: python3 -m pip install skills-ref==0.1.1', 'w', yes)).toHaveLength(1);
    expect(unhashed('  pip install --require-hashes mypy==1', 'w', yes)).toHaveLength(1);
    expect(unhashed('  pip install -r requirements.txt', 'w', yes)).toHaveLength(1);
    expect(
      unhashed('  "$T/bin/pip" install --require-hashes \\\n    -r a/requirements.txt', 'w', yes),
    ).toEqual([]);
    expect(
      unhashed('  pip install --require-hashes -r missing.txt', 'w', () => false),
    ).toHaveLength(1);
    expect(withoutHash(`mypy==1.0 \\\n    --hash=sha256:${'a'.repeat(64)}\nruff==2\n`)).toEqual([
      'ruff',
    ]);
    const installing = FILES.filter(
      (file) => pipInstalls(readFileSync(join(ROOT, file), 'utf-8')).length > 0,
    );
    expect(
      installing,
      'the workflows install nothing with pip, so this guard reads nothing',
    ).toContain('.github/workflows/ci.yml');
  });
});
