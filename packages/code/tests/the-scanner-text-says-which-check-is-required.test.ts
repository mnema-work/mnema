// @reads-the-tree
/**
 * THE TEXT ABOUT THE SCANNERS SAYS WHICH OF THEM A PULL REQUEST MUST CARRY.
 *
 * `main` requires the check `secrets in the history (gitleaks)` and does not require the one of
 * `osv-scanner`. The header of `scanners.yml` and the paragraph of `CONTRIBUTING.md` once said that
 * neither was required, and a contributor who read them would take a red gitleaks for advice. This
 * reads both texts and the job name, so the sentence cannot drift from the name the branch waits for.
 * The protection itself is a repository setting and is not testable offline.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf-8').replace(
    /\s*\n#?\s*/g,
    ' ',
  );

const WORKFLOW = read('.github/workflows/scanners.yml');
const CONTRIBUTING = read('CONTRIBUTING.md');

describe('the text about the scanners', () => {
  it('names gitleaks by the check main waits for, and says it is one a pull request must carry', () => {
    expect(WORKFLOW).toContain('name: secrets in the history (gitleaks)');
    expect(WORKFLOW).toContain(
      '`gitleaks` (the check `secrets in the history (gitleaks)`) is one of the checks a pull request must carry.',
    );
    expect(CONTRIBUTING).toContain(
      '`gitleaks` reads the whole history for a committed credential and is one of the checks a pull request must carry',
    );
  });

  it('says osv-scanner is not one of them, and never says so of both', () => {
    expect(WORKFLOW).toContain('`osv-scanner` is not:');
    expect(CONTRIBUTING).toContain('and is not one of them.');
    expect(WORKFLOW).not.toContain('it is not one of the checks a pull request must carry');
    expect(CONTRIBUTING).not.toContain('outside the checks a pull request must carry');
  });
});
