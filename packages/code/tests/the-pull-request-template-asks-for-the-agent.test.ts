// @reads-the-tree
/**
 * THE PULL REQUEST TEMPLATE ASKS FOR THE AGENT, and says it is required. The squash commit of a change
 * written with an agent carries a credit line taken from this field, so the template has to name
 * both things that line is made of (the model and the host), has to allow the answer `none`, and
 * CONTRIBUTING.md has to name the same field and the same line. This reads the template as it is in
 * the repository, not the body of any pull request.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const template = readFileSync(join(ROOT, '.github/pull_request_template.md'), 'utf-8');
const contributing = readFileSync(join(ROOT, 'CONTRIBUTING.md'), 'utf-8');

describe('the pull request template', () => {
  it('has a required agent field with a line for the model and one for the host', () => {
    expect(template).toMatch(/^## Written with an agent \(required\)$/m);
    expect(template).toMatch(/^- Model:/m);
    expect(template).toMatch(/^- Host:/m);
  });

  it('says in the field that it is required and that `none` is an answer', () => {
    const comment = template.slice(template.indexOf('## Written with an agent'));
    expect(comment).toContain('Required');
    expect(comment).toContain('"none"');
  });

  it('is described by CONTRIBUTING.md with the same field name and the credit line made from it', () => {
    expect(contributing).toContain('"Written with an agent"');
    expect(contributing).toContain('`Assisted-by: <model> via <host>`');
  });
});
