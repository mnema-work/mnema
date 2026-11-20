// @reads-the-tree
/**
 * THE NPX RECIPE RUNS THE PAGE. `docs/install.md` shows how to try mnema in a scratch repository with
 * `npx`, without installing it. `.github/workflows/ci.yml` has a job that packs `@mnema/code`,
 * reads that block from the page when it runs, turns `npx` toward the tarball (the one thing it
 * substitutes) and checks that the decision the block recorded is accepted and `verify` is green.
 *
 * What this reads is the files: the run itself is the job's. It holds the shape that would silently
 * stop meaning anything: the job gone or no longer calling the script, a path filter that lets a
 * pull request skip it, a copy of the block inside the script (so the page could change and the job
 * stay green), a `mnema` of the machine reachable from the block (so npx proves nothing), and the substituted command
 * drifting away from the lines of the page.
 */

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT_PATH = join(ROOT, '.github/the-npx-recipe/run.sh');
const SCRIPT = readFileSync(SCRIPT_PATH, 'utf-8');
const PAGE = readFileSync(join(ROOT, 'docs/install.md'), 'utf-8');
const README = readFileSync(join(ROOT, 'README.md'), 'utf-8');
const WORKFLOW = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf-8');

const withoutComments = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

const CODE = withoutComments(WORKFLOW);
const SCRIPT_CODE = withoutComments(SCRIPT);

const JOB = (() => {
  const from = CODE.indexOf('\n  the-npx-recipe:\n');
  expect(from, 'ci.yml has no job the-npx-recipe').toBeGreaterThan(-1);
  const rest = CODE.slice(from + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
})();

/** The page's block, found the way the script finds it. */
const BLOCK = (() => {
  const after = PAGE.split('\n## Try it without installing\n')[1] ?? '';
  const open = after.indexOf('```sh\n');
  const close = after.indexOf('\n```', open + 1);
  return after.slice(open + '```sh\n'.length, close);
})();

const NPX_LINES = BLOCK.split('\n').filter((l) => l.includes('npx '));

describe('the npx recipe runs the page', () => {
  it('is a job of ci.yml that runs on every pull request and push, with no path filter', () => {
    expect(CODE).toMatch(
      /^on:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request:\n {4}branches: \[main\]\n/m,
    );
    expect(CODE).not.toMatch(/\bpaths(-ignore)?:/);
    expect(JOB).not.toMatch(/^ {4}if:/m);
  });

  it('runs on Linux with Node at the floor, builds, and then runs the script', () => {
    expect(JOB).toMatch(/runs-on: ubuntu-24\.04/);
    expect(JOB).toMatch(/node-version: '24\.15\.0'/);
    expect(JOB).toMatch(/timeout-minutes: \d+/);
    const build = JOB.indexOf('run: pnpm build');
    const script = JOB.indexOf('run: bash .github/the-npx-recipe/run.sh');
    expect(build, 'the job does not build').toBeGreaterThan(-1);
    expect(script, 'the job does not run the script').toBeGreaterThan(build);
    expect(statSync(SCRIPT_PATH).mode & 0o111, 'the script is not executable').not.toBe(0);
  });

  it('reads the block from the page at run time and keeps no copy of it', () => {
    expect(SCRIPT_CODE).toContain('^## Try it without installing$');
    expect(SCRIPT_CODE).toMatch(/\$\{2:-\$root\/docs\/install\.md\}/);
    for (const line of BLOCK.split('\n').filter((l) => l.length > 12)) {
      expect(SCRIPT_CODE, `the script copies "${line}"`).not.toContain(line);
    }
  });

  it('packs the package, runs npx in an empty HOME with a trap for a bare mnema, and bounds the run', () => {
    expect(SCRIPT_CODE).toMatch(/pnpm pack --pack-destination/);
    expect(SCRIPT_CODE).toContain('command npx --yes --package');
    expect(SCRIPT_CODE).toContain('HOME="$home" PATH="$work/trap:$PATH"');
    expect(SCRIPT_CODE).toContain('the block called mnema outside npx');
    expect(SCRIPT_CODE).toMatch(/^bound=\d+$/m);
    expect(SCRIPT_CODE).toMatch(/timeout "\$bound"/);
  });

  it('substitutes only the package name, and every npx line of the page has that shape', () => {
    expect(SCRIPT_CODE).toContain('"--yes @mnema/code@"[0-9]*.[0-9]*.[0-9]*)');
    expect(SCRIPT_CODE).toContain('the block calls npx $*');
    expect(NPX_LINES.length).toBeGreaterThanOrEqual(5);
    for (const line of NPX_LINES) {
      expect(line, 'an npx line of the page the script would refuse').toMatch(
        /(^|\$\()npx --yes @mnema\/code@\d+\.\d+\.\d+ \S/,
      );
    }
  });

  it('is a block that founds, records, accepts, reads back and verifies', () => {
    expect(BLOCK).toMatch(/^mkdir mnema-try && cd mnema-try && git init -q$/m);
    expect(BLOCK).toMatch(/^npx --yes @mnema\/code@\S+ init$/m);
    expect(BLOCK).toMatch(/^ADR=\$\(npx --yes @mnema\/code@\S+ decision record /m);
    expect(BLOCK).toMatch(/^npx --yes @mnema\/code@\S+ decision move accept "\$ADR" /m);
    expect(BLOCK).toMatch(/^npx --yes @mnema\/code@\S+ show "\$ADR"$/m);
    expect(BLOCK).toMatch(/^npx --yes @mnema\/code@\S+ verify$/m);
  });

  it('checks the decision the block recorded, accepted, and verify', () => {
    expect(SCRIPT_CODE).toContain('local integrity verified');
    expect(SCRIPT_CODE).toContain('mnema show "$adr"');
    expect(SCRIPT_CODE).toContain('is not the decision the block recorded');
    expect(SCRIPT_CODE).toContain('is not accepted');
  });

  it('is reachable from the README and names the script that proves it', () => {
    expect(README).toContain('docs/install.md#try-it-without-installing');
    expect(PAGE).toContain('.github/the-npx-recipe/run.sh');
  });
});
