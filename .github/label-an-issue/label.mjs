#!/usr/bin/env node
/**
 * AN ISSUE OPENED FROM A FORM IS LABELLED WITH ITS AREA.
 *
 * `.github/workflows/label-an-issue.yml` runs this when an issue is opened:
 *
 *   node .github/label-an-issue/label.mjs "$GITHUB_EVENT_PATH"
 *
 * The forms in `.github/ISSUE_TEMPLATE/` ask for a host (the bug report) or an area (the feature
 * request). GitHub writes each answer into the body under a `### <question>` heading, and
 * `labelsFor` reads them back: the answer picks one `area:` label, and an issue that came from a
 * form also gets `needs triage` (a label GitHub drops from a form when it does not exist yet, so the
 * script creates it, once). An issue with no form answers, such as one a maintainer wrote by hand,
 * is left alone.
 *
 * THE BODY IS DATA. It is read from the event file GitHub wrote, split on headings and compared with
 * fixed answers, and put nowhere else: not in a shell line, not in a comment. The calls to GitHub go
 * through `gh` with an argument list, never through a shell.
 *
 * WHAT IT DOES NOT DO. It does not judge an answer, and it never removes a label.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const TRIAGE_LABEL = 'needs triage';
const TRIAGE_COLOR = 'ededed';
const TRIAGE_ABOUT = 'Not looked at by a maintainer yet';

/** The bug report's hosts. Any named host is an `area: hosts` report. */
export const HOSTS = [
  'Claude Code',
  'Codex',
  'Cursor',
  'VS Code',
  'Gemini CLI',
  'OpenCode',
  'Qwen Code',
];
/** Answers that name no host. */
export const NO_HOST = ['none / command line', 'other'];

/** The feature request's areas, each to the label it picks (`null` is "not sure"). */
export const AREAS = {
  'The record: decisions, tasks and the commands that read and write them': 'area: record',
  'The MCP server and its tools': 'area: mcp',
  'Host plugins, hooks and host contracts': 'area: hosts',
  "Instructions and the agents' rules files": 'area: instructions',
  'Stacks and their index': 'area: stacks',
  'CI templates for other forges and exports': 'area: integrations',
  'Build and packaging': 'area: build',
  "The contributor's own path": 'area: contributing',
  'Not sure': null,
};

/**
 * The answers of a form body, by question. An unanswered optional field reads `_No response_`.
 * @param {string} body
 * @returns {Map<string, string>}
 */
export function answers(body) {
  /** @type {Map<string, string>} */
  const found = new Map();
  const parts = String(body ?? '')
    .replace(/\r\n/g, '\n')
    .split(/^### +(.+?) *$/m);
  for (let at = 1; at < parts.length; at += 2) {
    found.set(String(parts[at]).trim(), String(parts[at + 1] ?? '').trim());
  }
  return found;
}

/**
 * The labels an issue body asks for: none when it holds no form answer.
 * @param {string} body
 * @returns {string[]}
 */
export function labelsFor(body) {
  const given = answers(body);
  if (given.size === 0) return [];
  /** @type {string[]} */
  const labels = [TRIAGE_LABEL];
  const host = given.get('Host');
  if (host !== undefined && HOSTS.includes(host)) labels.push('area: hosts');
  const area = given.get('Area');
  const picked = area === undefined ? undefined : Object.entries(AREAS).find(([k]) => k === area);
  if (picked?.[1]) labels.push(picked[1]);
  return [...new Set(labels)];
}

/**
 * @param {string} repo
 * @param {(args: string[]) => string} [run]
 */
export function ghApi(repo, run = (args) => execFileSync('gh', args, { encoding: 'utf-8' })) {
  return {
    /** @param {string} name */
    hasLabel(name) {
      try {
        run(['api', `repos/${repo}/labels/${encodeURIComponent(name)}`]);
        return true;
      } catch {
        return false;
      }
    },
    /** @param {string} name @param {string} color @param {string} description */
    createLabel(name, color, description) {
      run([
        'api',
        '-X',
        'POST',
        `repos/${repo}/labels`,
        '-f',
        `name=${name}`,
        '-f',
        `color=${color}`,
        '-f',
        `description=${description}`,
      ]);
    },
    /** @param {number} number @param {string[]} labels */
    addLabels(number, labels) {
      run([
        'api',
        '-X',
        'POST',
        `repos/${repo}/issues/${number}/labels`,
        ...labels.flatMap((one) => ['-f', `labels[]=${one}`]),
      ]);
    },
  };
}

/**
 * @param {{ issue?: { number: number, body?: string | null } }} event
 * @param {ReturnType<typeof ghApi>} api
 * @returns {string[]} the labels added
 */
export function label(event, api) {
  const issue = event.issue;
  if (!issue) return [];
  const labels = labelsFor(issue.body ?? '');
  if (labels.length === 0) return [];
  if (!api.hasLabel(TRIAGE_LABEL)) api.createLabel(TRIAGE_LABEL, TRIAGE_COLOR, TRIAGE_ABOUT);
  api.addLabels(issue.number, labels);
  return labels;
}

/** @param {string[]} argv */
function main(argv) {
  const [eventPath] = argv;
  if (!eventPath) {
    console.error('usage: label.mjs <event.json>');
    process.exit(2);
  }
  const event = JSON.parse(readFileSync(eventPath, 'utf-8'));
  const added = label(event, ghApi(process.env.GITHUB_REPOSITORY ?? ''));
  console.log(`labels: ${added.join(', ') || 'none'}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`label.mjs failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
