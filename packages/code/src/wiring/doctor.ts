/**
 * The `mnema doctor` wiring: what it declares, and what it prints.
 *
 * `mnema doctor`, what this machine says about how mnema is installed: the binary on the
 * `PATH`, the Claude Code plugin, the VS Code agent's plugin setting, the MCP server declared
 * twice, a namesake, a private tree left where it lived before it moved into the repository's
 * git directory. One line to a finding, each ending in what to do. Asked alone it reads and
 * writes nothing; `--fix vscode` writes one setting of VS Code's `settings.json`,
 * `--fix private-tree` moves those private trees, and `--fix merge-driver` writes the tails' merge
 * driver into the repository's `.git/config`: each only when a person asks (`commands/doctor.ts`,
 * `commands/doctor-merge-driver.ts`).
 */

import type { Command } from 'commander';
import { discoveryEnv } from '../env.js';
import { fact } from '../presentation/detail.js';
import { VERSION } from '../version.js';
import { here } from './context.js';
import { runTheUpgrade } from './upgrade.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** Registers `mnema doctor` on the program. */
export function registerDoctor(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  const verb = program
    .command('doctor')
    .description(
      'say how mnema is installed on this machine, and what to do about each thing found (writes nothing unless you pass --fix or --after-update)',
    )
    .option(
      '--fix <what>',
      'make the one change a finding asks for, and only that one: `vscode` lists the plugin in the chat.pluginLocations setting of VS Code’s settings.json, after keeping a copy of the file; `private-tree` moves the private notes a worktree still holds in .mnema/private/ into the repository’s git directory; `merge-driver` writes, into this repository’s git configuration, the merge driver the record’s tails name and then merge.autoStash and rebase.autoStash, so a plain `git pull` carries the record; it replaces a driver of mnema’s that cannot run here',
    )
    .option(
      '--after-update',
      'what `mnema upgrade` does: bring this project and machine up to the installed version, asking before anything that changes how the repository behaves',
    )
    .option('--dry-run', 'with --fix or --after-update: say what would change and write nothing')
    .addHelpText(
      'after',
      [
        '',
        'What it looks at, and nothing else:',
        '  the `mnema` executables on the PATH and which one is running; Claude Code’s list of',
        '  installed plugins; the mnema MCP server declared in .mcp.json, .cursor/mcp.json,',
        '  .vscode/mcp.json and ~/.claude.json, the plugin counting as one; and an npm package',
        '  named `mnema` installed where the PATH points: the registry is not asked; VS Code’s user',
        '  settings.json, for whether its agent is told where the plugin is; and the projects of',
        '  ~/.claude.json (the one in $CLAUDE_CONFIG_DIR, when it is set) that still declare the',
        '  server; the MCP config file each other host keeps in your home (Codex, Gemini CLI, Qwen',
        '  Code, Copilot CLI, OpenCode, Cursor, VS Code), for a second or a dead mnema entry; and, in a project inside a git repository, git’s stash and index, for an',
        '  autostash that holds a tail’s files or a tail file left in conflict by a pull (the fork',
        '  git hides, which `mnema status` says too), and',
        '  each worktree’s .mnema/private/, where private notes lived before they moved into the',
        '  repository’s git directory; and the agent keys this machine holds, against the record of',
        '  each tree it reaches, with the `MNEMA_AGENT_KEY` of its own environment.',
        'It also reads the ledger of caught failures, <data directory>/log/swallowed.jsonl, for the last 7 days (kept on this',
        'machine and never sent: docs/the-ledger-of-caught-failures.md).',
        'Asked alone it writes nothing and exits 0 whatever it finds: each line says what to do.',
        '`--fix vscode` writes: it shows what it will change, keeps a copy of settings.json beside',
        'it, keeps the file’s comments, and refuses a file it cannot edit safely.',
        '`--fix private-tree` writes: it moves each tail, as it is, into the repository’s private',
        'tree, and leaves where it was anything whose name there holds other bytes.',
        '`--fix merge-driver` writes: four settings in this repository’s .git/config, the only git',
        'configuration mnema writes: the tails’ merge driver’s name and the driver, then',
        'merge.autoStash and rebase.autoStash (which apply to every file of the clone, and are not',
        'written while the driver cannot run here), so that a plain `git pull` carries events of the',
        'record not yet committed. It replaces a driver of mnema’s that cannot run, and leaves a',
        'setting of the same name it did not write, and then writes none.',
        '`--after-update` is `mnema upgrade`: it applies what an update left of mnema’s own, asks before the',
        'merge driver and its autoStash settings, and says what a host keeps; `--dry-run` shows the plan.',
      ].join('\n'),
    )
    .action(async (options: { fix?: string; dryRun?: boolean; afterUpdate?: boolean }) => {
      if (options.afterUpdate === true) {
        if (options.fix !== undefined) {
          io.err(render(fact('`--after-update` and `--fix` cannot be given together.')));
          io.fail();
          return;
        }
        await runTheUpgrade(wiring, { dryRun: options.dryRun === true });
        return;
      }
      const { fixPrivateTree, fixVscode, runDoctor } = await import('../commands/doctor.js');
      const { fixMergeDriver } = await import('../commands/doctor-merge-driver.js');
      const { ownDriverCommand, ownRunningFile } = await import('../commands/record-pull.js');
      const ctx = {
        ...here(),
        env: discoveryEnv(),
        processEnv: process.env,
        running: { file: ownRunningFile(), version: VERSION },
      };
      if (options.fix !== undefined) {
        if (
          options.fix !== 'vscode' &&
          options.fix !== 'private-tree' &&
          options.fix !== 'merge-driver'
        ) {
          io.err(
            render(
              fact(
                '`--fix` knows how to fix three things: `vscode`, `private-tree` and `merge-driver`.',
              ),
            ),
          );
          io.fail();
          return;
        }
        const dryRun = options.dryRun === true;
        const fixed =
          options.fix === 'vscode'
            ? fixVscode(ctx, { dryRun })
            : options.fix === 'private-tree'
              ? fixPrivateTree(ctx, { dryRun })
              : fixMergeDriver(ctx, {
                  dryRun,
                  driver: ownDriverCommand(),
                });
        for (const line of fixed.lines) io.out(line);
        if (fixed.refused) io.fail();
        return;
      }
      if (options.dryRun === true) {
        io.err(
          render(
            fact(
              '`--dry-run` goes with `--fix` or `--after-update`; asked alone, `mnema doctor` writes nothing.',
            ),
          ),
        );
        io.fail();
        return;
      }
      const { findings } = runDoctor(ctx);
      for (const finding of findings) {
        io.out(`${finding.state === 'fine' ? 'ok' : 'to do'} · ${finding.topic}: ${finding.line}`);
      }
    });
  return readsTheRecord(verb);
}
