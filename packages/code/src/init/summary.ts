/**
 * WHAT `mnema init` SAYS ONCE IT HAS FOUNDED: the list of what was done, and the summary with what comes next.
 *
 * BOTH ARE PRINTED, never drawn: they are the lines a person scrolls back to, and a page of rows the layout
 * library owned would be gone with the screen. They are the same `Line`s the questions are, so the colour is
 * the one renderer's and the fold is its own.
 *
 * THE BACKUP KEY COMES FIRST AMONG THE NEXT STEPS, because it is the only one that can lose something: a key
 * that is not moved off this machine is lost with it, and mnema has no central recovery (an entity able to
 * restore an identity is an entity able to forge one). It is said only on the run that made the key, as the
 * warning always was: said on every run it is a sentence a person learns to scroll past. The identity is
 * shown short and, beneath it, whole on a line of its own, because the whole of it is what a person pastes
 * into a command and what a line that folds mid-value cannot give them. The backup key's file is said as
 * its folder and its name on two rows for the same reason: each stays whole.
 *
 * WHAT IS SAID ABOUT THE HOSTS IS THE TABLE'S (`host-names.ts`): the commands of a host are the ones the
 * install page's table carries for it, so a command is never a second copy that can fall behind the page
 * (`the-install-line-of-a-host-is-what-its-section-says.test.ts` holds the table to `docs/hosts.md`).
 */

import { basename, dirname } from 'node:path';
import type { MergeDriverFixed } from '../commands/doctor-merge-driver.js';
import type { InitResult } from '../commands/init.js';
import { changeLine, type InstructionsFile } from '../commands/instructions.js';
import { HOSTS } from '../host-names.js';
import type { Line } from '../presentation/line.js';
import { widthOfText } from '../presentation/width.js';
import { STARTS_OFF } from '../record-framing.js';
import { onOneLine } from '../wiring/on-one-line.js';
import type { WhoMayAcceptRecorded } from './accepts.js';
import { fromTheFolder } from './detect.js';
import { CHECK_QUESTION, CHECK_QUESTION_HOSTS, HOST_ROWS, hostMark } from './hosts.js';
import { noted, paragraph, roomOf, wrap } from './layout.js';
import type { Answers } from './plan.js';
import { bold, DONE, dim, END, heading, plain, theGuide, trail } from './screens.js';

/** Everything the two pages are made from. */
export interface Founded {
  readonly cwd: string;
  /** The result of a founding (`created` is true). */
  readonly result: InitResult;
  readonly answers: Answers;
  /** What recording the answer about agents accepting came to, when it was recorded. */
  readonly recorded?: WhoMayAcceptRecorded;
  /** What setting up a plain `git pull` came to, when it was asked for (`doctor-merge-driver.ts`). */
  readonly pulled?: MergeDriverFixed;
  /** A path as a person is told it: the home as `~`. */
  readonly shown: (path: string) => string;
}

/** What the founding did to one file the person should hear about on its own: what was left, refused or failed. */
function didToAFile(file: InstructionsFile, width: number): readonly Line[] {
  switch (file.did) {
    case 'unchanged':
      return noted(
        trail,
        [plain(`  kept   ${file.path}`)],
        dim('already holds the block'),
        width,
        9,
      );
    default:
      return paragraph(trail, changeLine(file), width, '  left   ');
  }
}

/** The order the rows of the files are said in: what was left, refused or failed, in the order the files came. */
const SAID_ON_ITS_OWN: readonly (InstructionsFile['did'] | undefined)[] = [
  'unchanged',
  'left',
  'refused',
  'failed',
];

/** A row for one choice: what was done, and the command that changes it later, beside it where they fit. */
export function chose(done: string, later: string, width: number): readonly Line[] {
  return noted(trail, [plain(`  done   ${done}`)], dim(`later: ${later}`), width, 9);
}

/** What a founding says it did about the instruction files: how many it wrote, and how many of them were yours. */
export function instructionFilesDone(count: number, yours: number): string {
  return `${String(count)} instruction file${count === 1 ? '' : 's'}${yours === 0 ? '' : ` (${String(yours)} of yours)`}`;
}

/** The command that takes the instruction files out again, said beside the row above. */
export const INSTRUCTIONS_LATER = '`mnema instructions --remove`';

/** What a founding says about agents accepting, and the command that changes it later. */
export const AGENTS_MAY_ACCEPT = 'agents may accept what you choose';
export const ACCEPTS_LATER = '`mnema switch`';

/** What a founding says it did about a plain `git pull`. */
export const PULL_DONE = 'a plain `git pull` carries the record';

/** The list of what the founding did, once it has done it: one row for each choice, with how to change it. */
export function foundingPage(founded: Founded, width: number): readonly Line[] {
  const { result, recorded, pulled } = founded;
  const around = result.around;
  const rows: Line[] = [heading(DONE, 'Founding')];
  if (around?.prettierIgnore !== undefined) {
    rows.push(
      ...noted(
        trail,
        [plain(`  done   ${fromTheFolder(founded.cwd, around.prettierIgnore.path)}`)],
        dim(around.prettierIgnore.did === 'created' ? 'created' : 'the line added'),
        width,
        9,
      ),
    );
  }
  const files = [...(around?.instructions ?? [])].filter((file) => file.did !== undefined);
  const written = files.filter((file) =>
    ['created', 'added', 'replaced'].includes(file.did as string),
  );
  if (written.length > 0) {
    const yours = written.filter((file) => file.did === 'added').length;
    rows.push(...chose(instructionFilesDone(written.length, yours), INSTRUCTIONS_LATER, width));
  }
  for (const file of files
    .filter((each) => SAID_ON_ITS_OWN.includes(each.did))
    .sort((a, b) => SAID_ON_ITS_OWN.indexOf(a.did) - SAID_ON_ITS_OWN.indexOf(b.did))) {
    rows.push(...didToAFile(file, width));
  }
  if (recorded !== undefined) {
    rows.push(
      ...chose(
        recorded.as === 'proposed'
          ? `${recorded.adr}, the agent’s proposal: it waits for you`
          : recorded.switchedOff
            ? `${recorded.adr}, yours: every decision waits for you (agent-accepts, off)`
            : `${recorded.adr}, yours: ${AGENTS_MAY_ACCEPT}`,
        ACCEPTS_LATER,
        width,
      ),
    );
  }
  if (pulled !== undefined) {
    rows.push(
      ...(pulled.refused
        ? paragraph(
            trail,
            `git’s configuration was left as it is: ${pulled.lines.join(' ')}`,
            width,
            '  ',
          )
        : paragraph(trail, PULL_DONE, width, '  done   ')),
    );
  }
  rows.push(theGuide);
  return rows;
}

/** What each row is called where a host has a command to run. */
const NAMED: { readonly [id in (typeof HOST_ROWS)[number]['id']]: string } = {
  claude: 'Claude Code',
  cursor: 'Cursor',
  vscode: 'VS Code',
  codex: 'Codex',
};

/** One next step: what it says, and the commands under it, each to be typed back whole. */
interface NextStep {
  readonly says: string;
  readonly commands: readonly string[];
}

/**
 * What a host needs, as `docs/hosts.md` says it for that host. Cursor's command-line agent and VS Code's agent
 * read the plugin Claude Code installs (the server is the same `mnema mcp`), so each says that, with the
 * Claude Code commands under it where Claude Code was not among the hosts chosen, and VS Code the one more
 * command its settings need. The Claude Code and Codex steps are the table's own commands.
 */
function hostStep(id: (typeof HOST_ROWS)[number]['id'], claudeIsChosen: boolean): NextStep {
  const install = HOSTS[id].install;
  if ('commands' in install) return { says: `${NAMED[id]}:`, commands: install.commands };
  const claude = HOSTS.claude.install;
  const plugin = 'commands' in claude && !claudeIsChosen ? claude.commands : [];
  if (id === 'vscode') {
    return {
      says: `VS Code: reads the Claude Code plugin${plugin.length > 0 ? '; install it, then:' : '; then:'}`,
      commands: [...plugin, 'mnema doctor --fix vscode'],
    };
  }
  return {
    says: `Cursor: its command-line agent reads the Claude Code plugin${plugin.length > 0 ? '; install it:' : '.'}`,
    commands: plugin,
  };
}

/** The next steps, in the order they are numbered. */
function nextSteps(founded: Founded): readonly NextStep[] {
  const { result, answers } = founded;
  const around = result.around;
  const steps: NextStep[] = [];
  if (around?.gitRoot !== undefined) {
    steps.push({
      says:
        around.recordIsLocal === true
          ? 'Git ignores `.mnema/` here: the record stays on this machine and no clone gets it.'
          : 'Commit `.mnema/` with the repository; every clone reads the record.',
      commands: [],
    });
    if (around.foundedBelowTheRoot) {
      steps.push({
        says: onOneLine`This is not the root of the git repository (${around.gitRoot}). A session opened at that root climbs from there and will not find a project founded below it: run \`mnema init\` there instead, unless the project is meant to live here.`,
        commands: [],
      });
    }
    if (founded.pulled === undefined) {
      steps.push({
        says: 'A plain `git pull` was not set up for the record: `mnema doctor --fix merge-driver` writes its settings, and `mnema record pull` pulls without them.',
        commands: [],
      });
    }
  }
  if (around?.biomeLine !== undefined) steps.push({ says: around.biomeLine, commands: [] });
  for (const row of HOST_ROWS) {
    if (!answers.marks.has(hostMark(row.id))) continue;
    steps.push(hostStep(row.id, answers.marks.has(hostMark('claude'))));
  }
  // The question to ask the agent comes after the steps that install the plugin, and only for a host that
  // has been shown answering (`CHECK_QUESTION_HOSTS`): a host that was not is left without one.
  const asked = HOST_ROWS.filter(
    (row) => CHECK_QUESTION_HOSTS.has(row.id) && answers.marks.has(hostMark(row.id)),
  ).map((row) => NAMED[row.id]);
  if (asked.length > 0) {
    steps.push({
      says: `In ${asked.join(' or ')}, with the plugin in, ask the agent: "${CHECK_QUESTION}"`,
      commands: [],
    });
  }
  for (const base of around?.neverImported ?? []) {
    steps.push({
      says: onOneLine`${String(base.documents)} decision file${base.documents === 1 ? '' : 's'} in ${base.directory} ${base.documents === 1 ? 'is' : 'are'} not in the record yet:`,
      commands: [`mnema decision import ${base.directory}`],
    });
  }
  if (answers.accepts === undefined) {
    steps.push({
      says: 'Whether an agent may accept what you choose was not asked: it may, and `mnema switch off agent-accepts` says it may not.',
      commands: [],
    });
  }
  steps.push({ says: '`mnema status` shows where things stand.', commands: [] });
  return steps;
}

/** A step as rows: its words wrapped, and its commands whole, beside the words where they fit and under them where not. */
function stepRows(step: NextStep, at: number, width: number): readonly Line[] {
  const lead = `  ${at + 1}  `;
  const [first, ...rest] = step.commands;
  if (first !== undefined && widthOfText(`${lead}${step.says} ${first}`) + 3 <= width) {
    return [
      trail(plain(`${lead}${step.says} ${first}`)),
      ...rest.map((each) =>
        trail(plain(`${' '.repeat(lead.length)}${' '.repeat(step.says.length + 1)}${each}`)),
      ),
    ];
  }
  return [
    ...paragraph(trail, step.says, width, lead),
    ...step.commands.map((each) => trail(plain(`${' '.repeat(lead.length)}${each}`))),
  ];
}

/** A space a command is not wrapped at: it is put back as a space once the words are wrapped. */
const NO_BREAK = '\u00a0';

/** The summary: who this is, the backup key, and what to do next. */
export function summaryPage(founded: Founded, width: number): readonly Line[] {
  const { result } = founded;
  const identity = result.identity;
  const short = (value: string, keep: number): string => value.slice(0, keep);
  const lines: Line[] = [
    heading(DONE, `Founded ${basename(founded.cwd)}/.mnema`),
    theGuide,
    // The whole of it, on a row of its own and never wrapped: it is what a person pastes into a command.
    trail(plain(`  ${result.anchor}`)),
  ];
  const backup = identity?.backup;
  if (backup !== undefined && backup !== null) {
    lines.push(
      trail(
        plain(`backup key  ${short(backup.fingerprint, 8)}`),
        dim(
          identity?.enrolled.includes(backup.fingerprint) === true
            ? 'enrolled in this project'
            : 'not enrolled in this project',
        ),
      ),
    );
  }
  for (const key of identity?.enrolled ?? []) {
    if (key === backup?.fingerprint) continue;
    lines.push(trail(plain(`key ${short(key, 8)}`), dim('enrolled in this project')));
  }
  for (const declined of identity?.declined ?? []) {
    lines.push(
      trail(plain(`key ${short(declined.fingerprint, 8)} was NOT enrolled: ${declined.reason}`)),
    );
  }
  lines.push(theGuide);
  if (backup?.created === true) {
    lines.push(
      trail(bold('  Move the backup key off this machine')),
      trail(plain(`  ${founded.shown(dirname(backup.privateKeyPath))}/`)),
      trail(plain(`  ${basename(backup.privateKeyPath)}`)),
      ...paragraph(
        trail,
        'mnema has no central recovery: a backup left on this disk is lost with it.',
        width,
        '  ',
      ),
      theGuide,
    );
  }
  lines.push(trail(bold('  Then')));
  for (const [at, step] of nextSteps(founded).entries()) {
    // A command is never wrapped: what is typed back is the whole of it, on a row of its own.
    lines.push(...stepRows(step, at, width));
  }
  // One line, the guide's end: what is off, and the verb that turns it on.
  const off = wrap(
    `Off until switched on: ${STARTS_OFF.join(', ')}; \`mnema${NO_BREAK}switch\` turns one on.`,
    roomOf(width),
  ).map((row) => row.replace(NO_BREAK, ' '));
  lines.push(theGuide);
  for (const [at, row] of off.entries()) {
    lines.push({ indent: 0, parts: [plain(at === 0 ? `${END}  ${row}` : `   ${row}`)] });
  }
  return lines;
}

/** The line that suggests a star, shown once to a person at the end of `mnema init` at a terminal. */
export const STAR_LINE =
  'If mnema helps, a star at github.com/mnema-work/mnema helps others find it.';

/** The suggestion as a page: the line, wrapped to the width and hung under the end of the trail. */
export function starPage(width: number): readonly Line[] {
  return wrap(STAR_LINE, width - 4).map(
    (row): Line => ({ indent: 0, parts: [plain(`   ${row}`)] }),
  );
}
