/**
 * Refuses a pull request whose title or description carries the em dash.
 *
 * The text is read from the event payload the runner wrote (a FILE). The commit messages are not
 * read: the squash commit is made of the title and the description, which a maintainer can edit,
 * and the messages of the branch never reach the trunk. Nothing a stranger wrote is ever
 * interpolated into a shell, and nothing of it is executed. The character is built from its code point, so this file
 * carries no dash of its own for the prose guard to count.
 *
 * Exit 0: clean. Exit 1: the lines that carry it, each with where. Exit 2: it could not tell.
 */

import { readFileSync } from 'node:fs';

export const THE_DASH = String.fromCharCode(0x2014);

/**
 * Every place the character appears.
 *
 * @param {{ title?: string, body?: string | null }} text
 * @returns {string[]} one finding per offending line, naming where it is
 */
export function dashesIn({ title = '', body = '' }) {
  const found = [];
  if (title.includes(THE_DASH)) found.push(`title: ${title}`);
  (body ?? '').split(/\r?\n/).forEach((line, index) => {
    if (line.includes(THE_DASH)) found.push(`body, line ${index + 1}: ${line}`);
  });
  return found;
}

export function main(eventPath = process.env.GITHUB_EVENT_PATH) {
  if (!eventPath) {
    console.error('RULER BROKEN: no event payload, so there is no pull request to read.');
    return 2;
  }
  const pr = JSON.parse(readFileSync(eventPath, 'utf-8')).pull_request;
  if (!pr) {
    console.error('RULER BROKEN: the event carries no pull request.');
    return 2;
  }
  const found = dashesIn({ title: pr.title, body: pr.body });
  if (found.length === 0) {
    console.log('NO EM DASH in the title or the description.');
    return 0;
  }
  console.error('EM DASH FOUND. Replace it with a comma, a colon, a period or a hyphen:');
  for (const one of found) console.error(`  ${one}`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main();
