// @reads-the-tree
/**
 * THE NEWCOMER'S PATH RUNS THE PAGE. `.github/workflows/ci.yml` has a job that packs the five
 * packages, installs the `@mnema/code` tarball alone with `npm i -g` into an empty prefix and runs, in a terminal, the
 * Quick start block of the README, read from the README when the job runs, then checks that the
 * decision it recorded is accepted and linked and that `verify` is green.
 *
 * What this reads is the files, and a file that says it runs is not a run: the script was driven end
 * to end by hand, and once more with `accept "$ADR"` put back as `accept ADR-1` in a copy of the
 * README (it went red: `init` records a decision of its own, so ADR-1 is already accepted). What
 * this holds is the shape that would silently stop meaning anything: the job gone or no longer
 * calling the script, a path filter that lets a pull request skip it, a Node above the floor, a
 * copy of the block inside the script (so the page could change and the job stay green), the
 * terminal replaced by a pipe (so `init` never asks), and the one command the script substitutes
 * drifting away from the first line of the page's block.
 */

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT_PATH = join(ROOT, '.github/the-newcomer-path/run.sh');
const SCRIPT = readFileSync(SCRIPT_PATH, 'utf-8');
const README = readFileSync(join(ROOT, 'README.md'), 'utf-8');
const WORKFLOW = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf-8');

/** The workflow and the script without their comment lines, so a sentence about it is not it. */
const withoutComments = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

const CODE = withoutComments(WORKFLOW);
const SCRIPT_CODE = withoutComments(SCRIPT);

/** The job, from its header to the next job (or the end of the file). */
const JOB = (() => {
  const from = CODE.indexOf('\n  the-newcomer-path:\n');
  expect(from, 'ci.yml has no job the-newcomer-path').toBeGreaterThan(-1);
  const rest = CODE.slice(from + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
})();

/** The README's Quick start block, found the way the script finds it. */
const BLOCK = (() => {
  const after = README.split('\n## Quick start\n')[1] ?? '';
  const open = after.indexOf('```sh\n');
  const close = after.indexOf('\n```', open + 1);
  return after.slice(open + '```sh\n'.length, close);
})();

describe("the newcomer's path runs the page", () => {
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
    const script = JOB.indexOf('run: bash .github/the-newcomer-path/run.sh');
    expect(build, 'the job does not build').toBeGreaterThan(-1);
    expect(script, 'the job does not run the script').toBeGreaterThan(build);
    expect(statSync(SCRIPT_PATH).mode & 0o111, 'the script is not executable').not.toBe(0);
  });

  it('reads the block from the README at run time and keeps no copy of it', () => {
    expect(SCRIPT_CODE).toContain('^## Quick start$');
    expect(SCRIPT_CODE).toMatch(/\$\{2:-\$root\/README\.md\}/);
    for (const line of BLOCK.split('\n').filter((l) => l.startsWith('mnema '))) {
      expect(SCRIPT_CODE, `the script copies "${line}"`).not.toContain(line);
    }
  });

  it('installs the tarballs the way a person installs, then runs the block in a terminal', () => {
    expect(SCRIPT_CODE).toMatch(/pnpm pack --pack-destination/);
    expect(SCRIPT_CODE).toMatch(/command npm i -g --prefix %q/);
    expect(SCRIPT_CODE).toMatch(/script -qec "bash \$runner" \/dev\/null/);
    expect(SCRIPT_CODE).toContain('HOME="$home" PATH="$prefix/bin:$PATH"');
    expect(SCRIPT_CODE).toMatch(/^bound=\d+$/m);
    expect(SCRIPT_CODE).toMatch(/timeout "\$bound"/);
  });

  it('substitutes only the one install command, which is the first line of the page block', () => {
    const shimmed = /\[ "\$\*" = "([^"]+)" \]/.exec(SCRIPT_CODE)?.[1];
    expect(shimmed).toBe('i -g @mnema/code');
    expect(BLOCK.split('\n')[0]).toBe(`npm ${shimmed}`);
    expect(SCRIPT_CODE).toContain('the block calls npm $*');
  });

  it('checks the decision the block recorded, accepted and linked, and verify', () => {
    expect(SCRIPT_CODE).toContain('local integrity verified');
    expect(SCRIPT_CODE).toContain('mnema show "$adr"');
    expect(SCRIPT_CODE).toContain('mnema refs "$adr"');
    expect(SCRIPT_CODE).toContain('is not the decision the block recorded');
    expect(SCRIPT_CODE).toContain('is not accepted');
    expect(SCRIPT_CODE).toContain('is not linked to');
  });

  it('is a block that records a decision, accepts the one it recorded, links it and verifies', () => {
    expect(BLOCK).toMatch(/^mnema init$/m);
    expect(BLOCK).toMatch(/^ADR=\$\(mnema decision record /m);
    expect(BLOCK).toMatch(/^mnema decision move accept "\$ADR" /m);
    expect(BLOCK).toMatch(/^mnema link "\$ADR" /m);
    expect(BLOCK).toMatch(/^mnema verify$/m);
  });
});
