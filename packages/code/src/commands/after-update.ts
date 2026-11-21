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
 * Nothing here runs npm or a host's `plugin` command, and no step writes a file the team shares without the
 * person's yes but the record's own attribute line, which `ensureTree` writes at every write of the record anyway.
 * The one write into the host's own `~/.claude.json` is the mnema server declared there a second time, cut by its
 * bytes after a copy of the file is kept beside it. `dryRun` writes nothing at all.
 */

import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureTree, mergeLineIsMissing } from '@mnema/chain';
import { resolveTrees } from '@mnema/core';
import { readMachineState, writeMachineState } from '../machine-state.js';
import { oneLine } from '../one-line.js';
import {
  type DoctorContext,
  fixVscode,
  type McpDeclarations,
  mcpDeclarations,
  pluginsLeftBehind,
  vscodeListsAFolderThatIsGone,
} from './doctor.js';
import {
  byHand,
  type HostMcpScan,
  keyOf,
  scanClaudeJson,
  scanEveryHost,
} from './doctor-host-mcp.js';
import { planRemoval, type TablePath } from './doctor-mcp.js';
import {
  AUTOSTASH_APPLIES_TO_EVERY_FILE,
  fixMergeDriver,
  mergeDriverLines,
} from './doctor-merge-driver.js';
import { checkInstructions, refreshIn } from './instructions.js';

/** What the plan needs: the doctor's context, and the command the merge driver setting would get. */
export interface AfterUpdateContext extends DoctorContext {
  readonly driver: string;
  /** `mnema upgrade --fix`: the dead MCP entries of every host's file are removed, after a copy of each file. */
  readonly fix?: boolean;
}

/** One thing an update leaves, and what it costs the person. */
export interface UpdateStep {
  readonly topic: 'instructions' | 'record' | 'vscode' | 'mcp' | 'merge-driver' | 'plugin';
  readonly class: 'applied' | 'asked' | 'said';
  /** What it is and what it changes, in a sentence. */
  readonly line: string;
  /** The command that does it by hand, where there is one. */
  readonly command?: string;
  /** The `mcp` step: the file it edits, and the entries of which table it drops. */
  readonly edit?: {
    readonly file: string;
    readonly drops: readonly Drop[];
    /** The hash of the file as the plan read it: a file that changed since is not written. */
    readonly seen: string;
  };
}

interface Drop {
  readonly table: TablePath;
  readonly names: readonly string[];
}

const DOCTOR_MERGE = 'mnema doctor --fix merge-driver';
const DOCTOR_VSCODE = 'mnema doctor --fix vscode';

/**
 * What an update leaves of the mnema MCP server declared twice. In the person's own `~/.claude.json` an entry goes when
 * the server is declared anywhere else the host reads and that works here (an enabled plugin, the entries of the project's `.mcp.json` it approved), and of two declarations
 * there alone the user one stays. The project's committed `.mcp.json` goes only beside an enabled plugin that serves the
 * same tools, and only asked: a teammate without the plugin may rely on it.
 */
function mcpSteps(found: McpDeclarations): UpdateStep[] {
  const steps: UpdateStep[] = [];
  const key = found.projectRoot;
  const here: Drop[] = [
    { table: ['mcpServers'], names: found.user },
    { table: ['projects', key, 'mcpServers'], names: found.project },
  ];
  const kept = found.working > 0;
  let leave = kept ? 0 : 1;
  const drops = here
    .map((one) => ({ ...one, names: one.names.filter(() => leave-- <= 0) }))
    .filter((one) => one.names.length > 0);
  if (drops.length > 0) {
    const names = drops.flatMap((one) => one.names).map(oneLine);
    const leftIn = (one: Drop | undefined): boolean =>
      one !== undefined &&
      one.names.length > (drops.find((d) => d.table === one.table)?.names.length ?? 0);
    const stays = kept
      ? 'the declaration of the plugin or of the approved .mcp.json stays'
      : leftIn(here[0])
        ? 'the entry of the user table stays'
        : 'the entry of this project stays';
    steps.push({
      topic: 'mcp',
      class: 'applied',
      line: `${oneLine(found.claudeJson)} declares the mnema MCP server again (${names.join(', ')}) where it is declared once already, so a session is offered every tool twice: the entr${names.length === 1 ? 'y goes' : 'ies go'} and ${stays}; no other byte of the file changes, and a copy of it is kept beside it.`,
      command: 'claude mcp remove mnema --scope user',
      edit: { file: found.claudeJson, drops, seen: hashOf(found.claudeJson) },
    });
  }
  if (found.pluginWorks && found.committed.names.length > 0) {
    steps.push({
      topic: 'mcp',
      class: 'asked',
      line: `${oneLine(found.committed.file)} declares the mnema MCP server and so does the installed plugin, so a session is offered every tool twice: this removes the entry from that file, which the team shares and commits; whoever works here without the plugin loses the server.`,
      command: 'claude mcp remove mnema --scope project',
      edit: {
        file: found.committed.file,
        drops: [{ table: ['mcpServers'], names: found.committed.names }],
        seen: hashOf(found.committed.file),
      },
    });
  }
  return steps;
}

const UPGRADE_FIX = 'mnema upgrade --fix';

/** Adds the drops to the ones a step of the same file already has: one file is edited once, from one reading. */
function mergeDrops(into: readonly Drop[], more: readonly Drop[]): Drop[] {
  const merged = into.map((one) => ({ table: one.table, names: [...one.names] }));
  for (const drop of more) {
    const there = merged.find((one) => JSON.stringify(one.table) === JSON.stringify(drop.table));
    if (there === undefined) merged.push({ table: drop.table, names: [...drop.names] });
    else there.names.push(...drop.names.filter((name) => !there.names.includes(name)));
  }
  return merged;
}

/**
 * The entries of a host's config file whose command or folder is gone (ADR-652). Without `--fix` each file with one is
 * only said, naming the entry; with it, a file this product edits byte for byte has the entry cut after a copy of the file,
 * and any other file (Codex's TOML, one with comments, one a team commits) is told the exact line to remove. A live
 * entry is never in a drop.
 */
function deadMcpSteps(
  ctx: AfterUpdateContext,
  declared: McpDeclarations,
  existing: readonly UpdateStep[],
): UpdateStep[] {
  const steps = [...existing];
  const root = declared.projectRoot;
  const scans: HostMcpScan[] = [
    scanClaudeJson(declared.claudeJson),
    ...scanEveryHost({
      home: ctx.env.home,
      processEnv: ctx.processEnv,
      platform: ctx.platform ?? process.platform,
      root,
      claudeJson: declared.claudeJson,
    }),
  ];
  for (const scan of scans) {
    const dead = scan.entries.filter((entry) => entry.dead !== undefined);
    if (dead.length === 0) continue;
    const where = oneLine(scan.file);
    const cut = dead.filter((entry) => scan.removable.includes(keyOf(entry)));
    const byYou = dead.filter((entry) => !cut.includes(entry));
    const living = scan.entries.filter(
      (entry) =>
        entry.dead === undefined &&
        (entry.table[0] !== 'projects' || entry.table[1] === declared.projectRoot),
    );
    const stays =
      living.length === 0
        ? ''
        : ` The entry that works stays: ${living.map((entry) => `“${oneLine(entry.name)}” in ${entry.table[0] === 'projects' ? 'this project' : 'the user table'}`).join(', ')}.`;
    const name = (entry: (typeof dead)[number]): string =>
      `“${oneLine(entry.name)}” (${oneLine(entry.dead ?? '')})`;
    if (ctx.fix !== true) {
      steps.push({
        topic: 'mcp',
        class: 'said',
        line: `${scan.title}: ${where} declares the mnema MCP server where it cannot start: ${dead.map(name).join('; ')}. Nothing was changed${cut.length > 0 ? `: \`${UPGRADE_FIX}\` removes ${cut.length === 1 ? 'it' : 'them'}, after a copy of the file is kept` : ''}${byYou.length > 0 ? `${cut.length > 0 ? '; ' : ': '}${byYou.map((entry) => oneLine(byHand(scan, entry))).join('; ')}` : ''}.${stays}`,
      });
      continue;
    }
    if (cut.length > 0) {
      const drops: Drop[] = [];
      for (const entry of cut) drops.push({ table: entry.table, names: [entry.name] });
      const line = `${scan.title}: ${where} declares the mnema MCP server where it cannot start: ${cut.map(name).join('; ')}: the entr${cut.length === 1 ? 'y goes' : 'ies go'}, no other byte of the file changes, and a copy of it is kept beside it.${stays}`;
      const same = steps.findIndex(
        (one) => one.edit?.file === scan.file && one.class === 'applied',
      );
      const before = steps[same];
      if (before?.edit !== undefined) {
        steps[same] = {
          ...before,
          line: `${before.line} Also: ${line}`,
          edit: { ...before.edit, drops: mergeDrops(before.edit.drops, drops) },
        };
      } else {
        steps.push({
          topic: 'mcp',
          class: 'applied',
          line,
          edit: { file: scan.file, drops: mergeDrops([], drops), seen: hashOf(scan.file) },
        });
      }
    }
    if (byYou.length > 0) {
      steps.push({
        topic: 'mcp',
        class: 'said',
        line: `${scan.title}: ${where} declares the mnema MCP server where it cannot start: ${byYou.map(name).join('; ')}. This product does not edit that file safely (${scan.format === 'toml' ? 'a TOML file' : scan.shared ? 'a team shares it' : 'it is not strict JSON, or the entry could not be cut byte for byte'}): ${byYou.map((entry) => oneLine(byHand(scan, entry))).join('; ')}.`,
      });
    }
  }
  return steps;
}

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
  const declared = mcpDeclarations(ctx);
  // A dead entry is not a candidate to stay: the live one is kept, and the dead one is the dead step's to say or cut.
  const dead = new Set(
    scanClaudeJson(declared.claudeJson)
      .entries.filter((entry) => entry.dead !== undefined)
      .map(keyOf),
  );
  const alive = (table: TablePath, names: readonly string[]): string[] =>
    names.filter((name) => !dead.has(keyOf({ name, table, dead: undefined })));
  steps.push(
    ...deadMcpSteps(
      ctx,
      declared,
      mcpSteps({
        ...declared,
        user: alive(['mcpServers'], declared.user),
        project: alive(['projects', declared.projectRoot, 'mcpServers'], declared.project),
      }),
    ),
  );
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

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

/** The hash of a file as it is now, or of nothing where it cannot be read. */
function hashOf(file: string): string {
  try {
    return sha(readFileSync(file, 'utf-8'));
  } catch {
    return '';
  }
}

/** Cuts the entries from the file, after a copy beside it where the file is the person's own; a refusal writes nothing. */
function dropDeclarations(
  edit: NonNullable<UpdateStep['edit']>,
  keepACopy: boolean,
): { readonly lines: readonly string[]; readonly failed: boolean } {
  const { file, drops } = edit;
  const where = oneLine(file);
  const original = readFileSync(file, 'utf-8');
  if (sha(original) !== edit.seen) {
    return {
      lines: [
        `failed · mcp: ${where} changed since the plan read it (the host may be writing it): it was not written; run \`mnema upgrade\` again.`,
      ],
      failed: true,
    };
  }
  let text = original;
  const removed: string[] = [];
  for (const drop of drops) {
    const plan = planRemoval(text, drop.table, drop.names);
    if (plan.kind === 'refused') {
      return {
        lines: [
          `failed · mcp: ${where} was not written, nothing changed: ${oneLine(plan.why)}; remove the entry by hand or with \`claude mcp remove\`.`,
        ],
        failed: true,
      };
    }
    if (plan.kind === 'change') {
      text = plan.text;
      removed.push(...plan.removed);
    }
  }
  if (text === original)
    return { lines: [`applied · mcp: nothing to remove in ${where}.`], failed: false };
  let kept = '';
  if (keepACopy) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const copy = `${file}.mnema-backup-${stamp}-${randomBytes(3).toString('hex')}`;
    // The copy holds the whole file, env blocks and their tokens included: readable by its owner alone, whatever the original's mode.
    writeFileSync(copy, original, { mode: 0o600, flag: 'wx' });
    chmodSync(copy, 0o600);
    kept = `; the file as it was is kept at ${oneLine(copy)} (readable by you only, and not cleaned up)`;
  }
  // Beside the file and renamed over it, so a reader never sees half of it; and the mode the host gave it stays.
  const beside = `${file}.mnema-tmp-${randomBytes(3).toString('hex')}`;
  writeFileSync(beside, text, { mode: statSync(file).mode & 0o777, flag: 'wx' });
  renameSync(beside, file);
  return {
    lines: [`applied · mcp: ${where}: removed ${removed.map(oneLine).join(', ')}${kept}.`],
    failed: false,
  };
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
    if (step.topic === 'mcp' && step.edit !== undefined) {
      return dropDeclarations(step.edit, step.class === 'applied');
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
