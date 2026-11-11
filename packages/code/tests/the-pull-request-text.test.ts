// @reads-the-tree
/**
 * A pull request whose title or description carries the em dash is refused, and the finding
 * says where. The commit messages are not read: the squash commit is the title and the
 * description. The cases hand the function titles and descriptions, and run the check on a
 * payload over a real range, and read the findings as values.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { dashesIn, main, THE_DASH } from '../../../.github/the-pull-request-text/check.mjs';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const DASH = String.fromCharCode(0x2014);

describe('the pull request text', () => {
  it('knows the character it refuses', () => {
    expect(THE_DASH).toBe(DASH);
    expect(THE_DASH.codePointAt(0)).toBe(0x2014);
  });

  it('lets a clean pull request through', () => {
    expect(dashesIn({ title: 'Fix the thing', body: 'one\ntwo\nthree' })).toEqual([]);
  });

  it('names the title', () => {
    expect(dashesIn({ title: `Fix ${DASH} the thing`, body: 'clean' })).toEqual([
      `title: Fix ${DASH} the thing`,
    ]);
  });

  it('names the line of the description', () => {
    const body = `one\ntwo\nthree ${DASH} three`;
    expect(dashesIn({ title: 'ok', body })).toEqual([`body, line 3: three ${DASH} three`]);
  });

  it('does not accuse a commit message that carries the dash, since commits are not read', () => {
    const repo = mkdtempSync(join(tmpdir(), 'pr-text-'));
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: repo, encoding: 'utf-8' }).trim();
    git('init', '-q');
    git('config', 'user.email', 'a@example.invalid');
    git('config', 'user.name', 'a');
    git('commit', '-q', '--allow-empty', '-m', 'base');
    const base = git('rev-parse', 'HEAD');
    git('commit', '-q', '--allow-empty', '-m', `subject ${DASH} here`);
    const head = git('rev-parse', 'HEAD');
    const payload = (title: string) => {
      const file = join(repo, `event-${title.length}.json`);
      writeFileSync(
        file,
        JSON.stringify({
          pull_request: { title, body: 'clean', base: { sha: base }, head: { sha: head } },
        }),
      );
      return file;
    };
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(repo);
    const out = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(main(payload('Fix the thing'))).toBe(0);
      expect(out).toHaveBeenCalledWith('NO EM DASH in the title or the description.');
      expect(main(payload(`Fix ${DASH} the thing`))).toBe(1);
    } finally {
      cwd.mockRestore();
      out.mockRestore();
      err.mockRestore();
    }
  });

  it('breaks the ruler when there is no payload', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(main(undefined)).toBe(2);
      expect(err).toHaveBeenCalledWith(expect.stringContaining('RULER BROKEN'));
    } finally {
      err.mockRestore();
    }
  });
});

describe('the job that runs it', () => {
  const workflow = readFileSync(join(REPO, '.github/workflows/the-pull-request-text.yml'), 'utf-8');

  it('runs when the text is edited, and never puts the text in a shell', () => {
    expect(workflow).toContain('name: the pull request text');
    expect(workflow).toContain('types: [opened, edited, synchronize, reopened]');
    expect(workflow).toContain('run: node .github/the-pull-request-text/check.mjs');
    expect(workflow).not.toContain('fetch-depth');
    expect(workflow).not.toContain('github.event.pull_request.title');
    expect(workflow).not.toContain('github.event.pull_request.body');
  });
});
