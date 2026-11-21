// @reads-the-tree
/**
 * Every workflow, and every script a workflow runs, that opens an issue gives it labels. An issue with
 * none lands in the list unsorted and nobody filters for it. The files are read as text: the opener
 * is `gh issue create` in a step or `['issue', 'create', ...]` in a script, and what follows it, up to
 * the end of the call, has to name `--label`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

const openers = (): { file: string; call: string }[] => {
  const files = execFileSync('git', ['ls-files', '.github'], { cwd: ROOT, encoding: 'utf-8' })
    .split('\n')
    .filter((one) => /\.(yml|mjs)$/.test(one));
  const found: { file: string; call: string }[] = [];
  for (const file of files) {
    const text = readFileSync(join(ROOT, file), 'utf-8');
    for (const at of text.matchAll(/issue['",\s]+create/g)) {
      const from = at.index ?? 0;
      const rest = text.slice(from);
      const end = rest.search(/\]\)|\n\s*fi\n|\n\s*else\n/);
      found.push({ file, call: rest.slice(0, end === -1 ? 400 : end) });
    }
  }
  return found;
};

describe('the issues a workflow opens carry labels', () => {
  it('finds the four openers', () => {
    expect(
      openers()
        .map((one) => one.file)
        .sort(),
    ).toEqual([
      '.github/the-hot-path-budget/measure.mjs',
      '.github/the-links-after-the-merge/check.mjs',
      '.github/workflows/flake-sampler.yml',
      '.github/workflows/host-contract.yml',
    ]);
  });

  it.each(openers().map((one) => [one.file, one.call] as const))(
    '%s labels what it opens',
    (file, call) => {
      expect(call, `${file}: a step or script opens an issue without --label`).toContain('--label');
    },
  );

  it('holds every workflow an issue opens or is labelled by: no default permissions, issues written by the job alone', () => {
    const workflows = execFileSync('git', ['ls-files', '.github/workflows'], {
      cwd: ROOT,
      encoding: 'utf-8',
    })
      .split('\n')
      .filter((one) => one.endsWith('.yml'));
    const listening = workflows.filter((file) =>
      /^on:[\s\S]*?^ {2}issues:/m.test(readFileSync(join(ROOT, file), 'utf-8')),
    );
    expect(listening).toEqual(['.github/workflows/label-an-issue.yml']);
    for (const file of listening) {
      const text = readFileSync(join(ROOT, file), 'utf-8');
      expect(text, `${file}: the workflow's own permissions are not empty`).toMatch(
        /^permissions: \{\}$/m,
      );
      expect(text, `${file}: writes more than issues`).not.toMatch(
        /(contents|pull-requests|actions|checks|statuses|packages): write/,
      );
      expect(text, `${file}: a shell line holds an expression`).not.toMatch(/run:.*\$\{\{/);
    }
  });
});
