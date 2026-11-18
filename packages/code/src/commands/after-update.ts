/**
 * WHAT AN UPDATE LEAVES UNDONE, said once and done once: `mnema upgrade` and `mnema doctor --after-update` are the
 * two doors of this one function (ADR-306, ADR-379).
 *
 * Installing the new package stays with npm (ADR-140): this runs after it, and asks nobody over a network. It
 * finds what the new version would do differently for a project and a machine that were set up by an earlier one,
 * and sorts each thing by what it costs the person:
 *
 *   applied  done without asking: it is mnema's own text, put at this version, in a place the person chose or the
 *            record owns (an instructions block they kept, the record's `.gitattributes` merge line, the one
 *            setting of VS Code that points at a plugin folder that is gone);
 *   asked    changes how the repository or the clone behaves, or writes where a team shares: the merge driver with
 *            its two autoStash settings, which apply to every file of the clone. Asked at a terminal, one by one;
 *            without one it is listed as the command;
 *   said     not this verb's to do: the plugin a host keeps, which only the host updates. The words are the
 *            doctor's, from the same function.
 *
 * Nothing here runs npm, a host's `plugin` command, or writes into `~/.claude.json`, and no step writes a file the
 * team shares without the person's yes but the record's own attribute line, which `ensureTree` writes at every
 * write of the record anyway. `dryRun` writes nothing at all.
 */

import { join } from 'node:path';
import { ensureTree, mergeLineIsMissing } from '@mnema/chain';
import { resolveTrees } from '@mnema/core';
import { readMachineState, writeMachineState } from '../machine-state.js';
import { oneLine } from '../one-line.js';
import {
  type DoctorContext,
  fixVscode,
  pluginsLeftBehind,
  vscodeListsAFolderThatIsGone,
} from './doctor.js';
import {
  AUTOSTASH_APPLIES_TO_EVERY_FILE,
  fixMergeDriver,
  mergeDriverLines,
} from './doctor-merge-driver.js';
import { checkInstructions, refreshIn } from './instructions.js';

/** What the plan needs: the doctor's context, and the command the merge driver setting would get. */
export interface AfterUpdateContext extends DoctorContext {
  readonly driver: string;
}

/** One thing an update leaves, and what it costs the person. */
export interface UpdateStep {
  readonly topic: 'instructions' | 'record' | 'vscode' | 'merge-driver' | 'plugin';
  readonly class: 'applied' | 'asked' | 'said';
  /** What it is and what it changes, in a sentence. */
  readonly line: string;
  /** The command that does it by hand, where there is one. */
  readonly command?: string;
}

const DOCTOR_MERGE = 'mnema doctor --fix merge-driver';
const DOCTOR_VSCODE = 'mnema doctor --fix vscode';

/** The files of the project that hold an earlier version's instructions block, as the project's paths. */
function outdatedInstructions(root: string): string[] {
  return checkInstructions(root)
    .filter((file) => file.found.state === 'outdated')
    .map((file) => file.path);
}

/**
 * The plan: every step, in the order they run, each with its class. Reads only: it opens no tail and writes no
 * file, so `--dry-run` is this and nothing else.
 */
export function whatAnUpdateAsks(ctx: AfterUpdateContext): readonly UpdateStep[] {
  const steps: UpdateStep[] = [];
  const record = resolveTrees(ctx.cwd, ctx.env).projectPublic;
  let attributeWillBeWritten = false;
  if (record !== undefined) {
    const root = join(record, '..');
    const outdated = outdatedInstructions(root);
    if (outdated.length > 0) {
      steps.push({
        topic: 'instructions',
        class: 'applied',
        line: `${outdated.map(oneLine).join(', ')} hold${outdated.length === 1 ? 's' : ''} an earlier version's mnema instructions block, which you kept there: the text between its markers becomes this version's, and nothing outside the markers is touched.`,
        command: 'mnema instructions',
      });
    }
    if (mergeLineIsMissing({ root: record })) {
      attributeWillBeWritten = true;
      steps.push({
        topic: 'record',
        class: 'applied',
        line: `the record's .gitattributes at ${oneLine(join(record, '.gitattributes'))} lacks the line that names the merge driver for its tails (merge=mnema-tail): it is added, nothing else changes, and the file is the record's, committed with it. The next write of the record adds it as well.`,
      });
    }
  }
  if (vscodeListsAFolderThatIsGone(ctx)) {
    steps.push({
      topic: 'vscode',
      class: 'applied',
      line: "VS Code's settings.json lists a mnema plugin folder that is no longer there: it is pointed at the marketplace's copy, after a copy of the file is kept beside it, and a setting you turned off stays off.",
      command: DOCTOR_VSCODE,
    });
  }
  const forDriver = { ...ctx, ...(attributeWillBeWritten ? { attributeWillBeWritten } : {}) };
  if (mergeDriverLines(forDriver).length > 0) {
    const would = fixMergeDriver(forDriver, { dryRun: true, driver: ctx.driver });
    if (!would.refused && (would.keys?.length ?? 0) > 0) {
      steps.push({
        topic: 'merge-driver',
        class: 'asked',
        line: `git does not hold all the merge driver the record names for its tails needs here: this writes ${(would.keys ?? []).join(', ')} into this repository's .git/config, so a plain \`git pull\` carries events of the record not yet committed. ${AUTOSTASH_APPLIES_TO_EVERY_FILE}`,
        command: DOCTOR_MERGE,
      });
    }
  }
  for (const behind of pluginsLeftBehind(ctx)) {
    steps.push({ topic: 'plugin', class: 'said', line: behind.line });
  }
  return steps;
}

/** What `bringUpToDate` hands back to the door. */
export interface UpdateReport {
  readonly lines: readonly string[];
  /** A step that was started did not finish: the exit is a failure. */
  readonly failed: boolean;
}

const WHEN: Readonly<Record<'dry' | 'plan', Readonly<Record<UpdateStep['class'], string>>>> = {
  dry: { applied: 'would apply', asked: 'would ask', said: 'to do' },
  plan: { applied: 'will apply', asked: 'will ask', said: 'to do' },
};

function said(label: string, step: UpdateStep): string {
  return `${label} · ${step.topic}: ${step.line}${step.command === undefined ? '' : ` (${step.command})`}`;
}

/** Does one `applied` or confirmed `asked` step, and says what it did. */
function doStep(
  ctx: AfterUpdateContext,
  step: UpdateStep,
): { readonly lines: readonly string[]; readonly failed: boolean } {
  try {
    const record = resolveTrees(ctx.cwd, ctx.env).projectPublic;
    if (step.topic === 'instructions' && record !== undefined) {
      const root = join(record, '..');
      const done = refreshIn(root, outdatedInstructions(root));
      const bad = done.filter((file) => file.did === 'refused' || file.did === 'failed');
      return {
        lines: [
          ...done
            .filter((file) => !bad.includes(file))
            .map((file) => `applied · instructions: ${oneLine(file.path)} is at this version.`),
          ...bad.map(
            (file) =>
              `failed · instructions: ${oneLine(file.path)} was not written${file.error === undefined ? '' : ` (${oneLine(file.error)})`}${file.again === undefined ? '' : `: \`${file.again}\` tries again`}.`,
          ),
        ],
        failed: bad.length > 0,
      };
    }
    if (step.topic === 'record' && record !== undefined) {
      // The one function that writes the record's own files: it adds the line it lacks and nothing more.
      ensureTree({ root: record });
      return {
        lines: [
          `applied · record: the merge line is in ${oneLine(join(record, '.gitattributes'))}.`,
        ],
        failed: false,
      };
    }
    if (step.topic === 'vscode') {
      const fixed = fixVscode(ctx, { dryRun: false });
      return {
        lines: fixed.lines.map(
          (line) => `${fixed.refused ? 'failed' : 'applied'} · vscode: ${line}`,
        ),
        failed: fixed.refused,
      };
    }
    if (step.topic === 'merge-driver') {
      const fixed = fixMergeDriver(ctx, { dryRun: false, driver: ctx.driver });
      return {
        lines: fixed.lines.map(
          (line) => `${fixed.refused ? 'failed' : 'applied'} · merge-driver: ${line}`,
        ),
        failed: fixed.refused,
      };
    }
    return { lines: [], failed: false };
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return { lines: [`failed · ${step.topic}: ${oneLine(why)}`], failed: true };
  }
}

/**
 * The upgrade, whichever door asked. At a terminal (`ask` given) it shows the plan, applies what is `applied` and
 * asks each `asked` step; without one it applies the `applied` ones and lists the `asked` as commands. With
 * `dryRun` it shows the plan and writes nothing, the machine's state file included. A run that finished without
 * a failed step writes the version it brought things to into that file (`machine-state.ts`).
 */
export async function bringUpToDate(
  ctx: AfterUpdateContext,
  options: {
    readonly dryRun: boolean;
    readonly ask?: (question: string) => Promise<string>;
  },
): Promise<UpdateReport> {
  const plan = whatAnUpdateAsks(ctx);
  const lines: string[] = [];
  if (options.dryRun) {
    for (const step of plan) lines.push(said(WHEN.dry[step.class], step));
    lines.push(
      plan.length === 0
        ? 'nothing to bring up to date here; nothing was written.'
        : 'nothing was written.',
    );
    return { lines, failed: false };
  }
  if (options.ask !== undefined)
    for (const step of plan) lines.push(said(WHEN.plan[step.class], step));
  let failed = false;
  for (const step of plan.filter((one) => one.class === 'applied')) {
    const done = doStep(ctx, step);
    lines.push(...done.lines);
    failed ||= done.failed;
  }
  for (const step of plan.filter((one) => one.class === 'asked')) {
    if (options.ask === undefined) {
      lines.push(said('to run', step));
      continue;
    }
    const answer = (await options.ask(`${step.topic}: ${step.line}\nType yes to do this: `))
      .trim()
      .toLowerCase();
    if (answer !== 'yes') {
      lines.push(
        `left · ${step.topic}: not done${step.command === undefined ? '' : `; ${step.command} does it later`}.`,
      );
      continue;
    }
    const done = doStep(ctx, step);
    lines.push(...done.lines);
    failed ||= done.failed;
  }
  if (options.ask === undefined) {
    for (const step of plan.filter((one) => one.class === 'said')) lines.push(said('to do', step));
  }
  if (plan.length === 0) lines.push('nothing to bring up to date here.');
  if (!failed) rememberTheVersion(ctx);
  return { lines, failed };
}

/** The machine's state file keeps the version a finished upgrade brought things to; a file that cannot be kept is no failure. */
function rememberTheVersion(ctx: AfterUpdateContext): void {
  try {
    const dir = resolveTrees(ctx.cwd, ctx.env).global;
    writeMachineState(dir, { ...readMachineState(dir), appliedVersion: ctx.running.version });
  } catch {
    // The upgrade is done; a state that cannot be written is read as "not told" by whoever asks next.
  }
}
