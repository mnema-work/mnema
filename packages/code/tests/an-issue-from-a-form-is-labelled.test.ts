// @reads-the-tree
/**
 * AN ISSUE OPENED FROM A FORM IS LABELLED WITH ITS AREA: the host a bug report names, or the area a
 * feature request names, picks one `area:` label, and every issue that came from a form also gets
 * `needs triage`. An issue with no form answers gets nothing. The last cases read the forms and the
 * workflow: the forms close blank issues and name only labels the repository has, every answer a form
 * can give is one the script reads, and a stranger's issue body runs nothing.
 *
 * `.github/label-an-issue/label.mjs` keeps each decision in a pure function, so these cases hand it
 * bodies as GitHub writes them and a stand-in for GitHub that records what would be written.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AREAS,
  answers,
  HOSTS,
  label,
  labelsFor,
  NO_HOST,
  TRIAGE_LABEL,
} from '../../../.github/label-an-issue/label.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const bug = (host: string) =>
  `### Version\n\n0.1.7\n\n### Host\n\n${host}\n\n### System\n\nLinux\n\n### Steps to reproduce\n\n1. run it\n\n### Expected vs actual\n\nit broke`;
const feature = (area: string) => `### Area\n\n${area}\n\n### The problem\n\nI cannot do a thing`;

describe('the answers are read from the body', () => {
  it('splits on the headings GitHub writes, with either line ending', () => {
    expect(answers(bug('Codex').replace(/\n/g, '\r\n')).get('Host')).toBe('Codex');
    expect(answers(bug('Codex')).get('Steps to reproduce')).toBe('1. run it');
  });

  it('reads a body with no heading as no answers', () => {
    expect(answers('just some words\nno heading').size).toBe(0);
    expect(answers(null as unknown as string).size).toBe(0);
  });
});

describe('the labels a body asks for', () => {
  it.each(HOSTS)('a bug on %s is an hosts report', (host) => {
    expect(labelsFor(bug(host))).toEqual([TRIAGE_LABEL, 'area: hosts']);
  });

  it.each(NO_HOST)('a bug on "%s" names no area', (host) => {
    expect(labelsFor(bug(host))).toEqual([TRIAGE_LABEL]);
  });

  it('a feature request takes the label of its area', () => {
    expect(labelsFor(feature('The MCP server and its tools'))).toEqual([TRIAGE_LABEL, 'area: mcp']);
    expect(labelsFor(feature('Not sure'))).toEqual([TRIAGE_LABEL]);
  });

  it('an answer the script does not know picks no area, so a body cannot invent a label', () => {
    expect(labelsFor(feature('area: record'))).toEqual([TRIAGE_LABEL]);
    expect(labelsFor(feature('constructor'))).toEqual([TRIAGE_LABEL]);
    expect(labelsFor(bug('hosts'))).toEqual([TRIAGE_LABEL]);
  });

  it('an issue written by hand, with no form answer, gets nothing', () => {
    expect(labelsFor('The host is Codex and the area is the MCP server')).toEqual([]);
    expect(labelsFor('')).toEqual([]);
  });
});

describe('the labels are written', () => {
  const standIn = (existing: string[]) => {
    const writes: unknown[][] = [];
    return {
      writes,
      api: {
        hasLabel: (name: string) => existing.includes(name),
        createLabel: (...args: unknown[]) => writes.push(['create', ...args]),
        addLabels: (...args: unknown[]) => writes.push(['add', ...args]),
      },
    };
  };

  it('creates needs triage when the repository has none, then adds the labels', () => {
    const { api, writes } = standIn([]);
    expect(label({ issue: { number: 7, body: bug('Cursor') } }, api)).toEqual([
      TRIAGE_LABEL,
      'area: hosts',
    ]);
    expect(writes).toEqual([
      ['create', TRIAGE_LABEL, 'ededed', 'Not looked at by a maintainer yet'],
      ['add', 7, [TRIAGE_LABEL, 'area: hosts']],
    ]);
  });

  it('creates nothing when the label exists, and writes nothing for an issue with no form', () => {
    const one = standIn([TRIAGE_LABEL]);
    label({ issue: { number: 8, body: feature('Build and packaging') } }, one.api);
    expect(one.writes).toEqual([['add', 8, [TRIAGE_LABEL, 'area: build']]]);
    const none = standIn([]);
    expect(label({ issue: { number: 9, body: 'by hand' } }, none.api)).toEqual([]);
    expect(none.writes).toEqual([]);
  });
});

const dropdownOptions = (form: string, question: string) => {
  const from = form.indexOf(`label: ${question}\n`);
  const block = form.slice(from).split('\n');
  const options: string[] = [];
  let inside = false;
  for (const line of block) {
    if (/^\s+options:\s*$/.test(line)) inside = true;
    else if (inside && /^\s+- /.test(line)) {
      options.push(line.replace(/^\s+- /, '').replace(/^"(.*)"$/, '$1'));
    } else if (inside) break;
  }
  return options;
};

describe('the forms and the workflow', () => {
  const bugForm = read('.github/ISSUE_TEMPLATE/bug_report.yml');
  const featureForm = read('.github/ISSUE_TEMPLATE/feature_request.yml');

  it('every host and area a form offers is one the script reads', () => {
    const hosts = dropdownOptions(bugForm, 'Host');
    expect(hosts.length).toBeGreaterThan(0);
    expect(hosts).toEqual([...HOSTS, ...NO_HOST]);
    const areas = dropdownOptions(featureForm, 'Area');
    expect(areas.length).toBeGreaterThan(0);
    expect(areas).toEqual(Object.keys(AREAS));
  });

  it('every label the script applies is one the repository has', () => {
    const named = Object.values(AREAS).filter((one): one is string => one !== null);
    expect(named.length).toBe(8);
    for (const one of [...named, 'area: hosts']) {
      expect(one).toMatch(
        /^area: (record|mcp|hosts|instructions|stacks|integrations|build|contributing)$/,
      );
    }
  });

  it('blank issues are closed and a security problem has a private way in', () => {
    const config = read('.github/ISSUE_TEMPLATE/config.yml');
    expect(config).toMatch(/^blank_issues_enabled: false$/m);
    expect(config).toContain('https://github.com/mnema-work/mnema/discussions');
    expect(config).toContain('https://github.com/mnema-work/mnema/security/advisories/new');
  });

  it.each(['bug_report.yml', 'feature_request.yml', 'internal_error.yml'])(
    '%s applies needs triage and a type',
    (file) => {
      const labels = /^labels: \[(.*)\]$/m.exec(read(`.github/ISSUE_TEMPLATE/${file}`))?.[1] ?? '';
      expect(labels.split(', ')).toContain(TRIAGE_LABEL);
      expect(labels).toMatch(/\b(bug|enhancement)\b/);
    },
  );

  it('the bug report asks for the host, system, Node and install, and names no script only a clone has', () => {
    for (const question of [
      'Version',
      'Host',
      'System',
      'Node version',
      'How mnema was installed',
    ]) {
      expect(bugForm).toContain(`label: ${question}\n`);
    }
    expect(bugForm).not.toContain('smoke:bootstrap');
    expect(featureForm).not.toMatch(/^\s+required: false$/m);
  });

  it('the workflow writes issues and nothing else, pins by SHA, and puts no expression of the issue in a shell line', () => {
    const workflow = read('.github/workflows/label-an-issue.yml');
    expect(workflow).toMatch(/^permissions: \{\}$/m);
    expect(workflow).toMatch(/^ {4}permissions:\n {6}issues: write\n {4}steps:/m);
    expect(workflow).not.toMatch(/pull_request_target|workflow_run/);
    for (const use of workflow.matchAll(/uses: (\S+)/g)) {
      expect(use[1]).toMatch(/@[0-9a-f]{40}$/);
    }
    const runs = workflow
      .split('\n')
      .filter((line) => /^\s+run:/.test(line) || /^\s+(?:-\s+)?run:/.test(line));
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) expect(run).not.toContain('${{');
    expect(workflow).not.toMatch(/github\.event\.issue/);
  });
});
