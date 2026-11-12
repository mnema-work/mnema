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
    expect(
      template,
      '.github/pull_request_template.md: restore the heading "## Written with an agent (required)"',
    ).toMatch(/^## Written with an agent \(required\)$/m);
    expect(
      template,
      '.github/pull_request_template.md: add a "- Model:" line under the agent field',
    ).toMatch(/^- (\*\*)?Model:/m);
    expect(
      template,
      '.github/pull_request_template.md: add a "- Host:" line under the agent field',
    ).toMatch(/^- (\*\*)?Host:/m);
  });

  it('keeps the two sections the contribution guide sends a reader to', () => {
    expect(
      template,
      '.github/pull_request_template.md: restore the heading "## What changes and why", which CONTRIBUTING.md points to',
    ).toMatch(/^## What changes and why$/m);
    expect(
      template,
      '.github/pull_request_template.md: restore the heading "## Proof", which CONTRIBUTING.md points to',
    ).toMatch(/^## Proof$/m);
  });

  it('says in the field that it is required and that `none` is an answer', () => {
    const comment = template.slice(template.indexOf('## Written with an agent'));
    expect(
      comment,
      '.github/pull_request_template.md: the agent field must say "Required"',
    ).toContain('Required');
    expect(
      comment,
      '.github/pull_request_template.md: the agent field must say that `none` is an answer',
    ).toMatch(/["`]none["`]/);
  });

  it('is described by CONTRIBUTING.md with the same field name and the credit line made from it', () => {
    expect(
      contributing,
      'CONTRIBUTING.md: name the template field "Written with an agent" exactly',
    ).toContain('"Written with an agent"');
    expect(
      contributing,
      'CONTRIBUTING.md: show the credit line `Assisted-by: <model> via <host>` exactly',
    ).toContain('`Assisted-by: <model> via <host>`');
  });
});
