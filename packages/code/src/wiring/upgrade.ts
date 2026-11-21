/**
 * The `mnema upgrade` wiring, and the one function `mnema doctor --after-update` calls too.
 *
 * `mnema upgrade`, what to do after installing a newer mnema: it applies what is mnema's own to put at this
 * version, asks before what changes how the repository behaves, and says what a host keeps (ADR-306). Installing
 * the package stays with npm (ADR-140) and nothing here asks a network. It is one function behind two doors
 * (ADR-379), so the two cannot print different things (`commands/after-update.ts`), and it is on the command
 * line alone (ADR-432): no tool of the MCP server runs it.
 */

import type { Command } from 'commander';
import { discoveryEnv } from '../env.js';
import { VERSION } from '../version.js';
import { here } from './context.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** Runs the upgrade for the project the process is in, the same way from both doors. */
export async function runTheUpgrade(wiring: Wiring, options: { dryRun: boolean }): Promise<void> {
  const { io } = wiring;
  const { bringUpToDate } = await import('../commands/after-update.js');
  const { ownDriverCommand } = await import('../commands/record-pull.js');
  const report = await bringUpToDate(
    {
      ...here(),
      env: discoveryEnv(),
      processEnv: process.env,
      running: { file: process.argv[1] ?? '', version: VERSION },
      driver: ownDriverCommand(),
    },
    {
      dryRun: options.dryRun,
      ...(io.aPersonIsHere === true && io.ask !== undefined ? { ask: io.ask } : {}),
    },
  );
  for (const line of report.lines) io.out(line);
  if (report.failed) io.fail();
}

/** Registers `mnema upgrade` on the program. */
export function registerUpgrade(program: Command, wiring: Wiring): Declared {
  const verb = program
    .command('upgrade')
    .description(
      'after installing a newer mnema: bring this project and machine up to it, asking before anything that changes how the repository behaves',
    )
    .option('--dry-run', 'show the plan and write nothing')
    .addHelpText(
      'after',
      [
        '',
        'The same as `mnema doctor --after-update`. It does not install anything: `npm i -g @mnema/code` stays',
        'yours, and it asks no network. Run it in the project, after the install.',
        'It applies, without asking: this version’s instructions block in the files that already hold an earlier',
        'one, the line of the record’s .gitattributes that names the merge driver, and the setting of VS Code’s',
        'settings.json that points at a plugin folder that is gone (a copy of the file is kept), and the mnema MCP',
        'server entry of your ~/.claude.json when an enabled plugin or an approved .mcp.json declares it too (a',
        'copy is kept; the entries of the project’s committed .mcp.json are asked, like the git settings).',
        'It asks, at a terminal, before the merge driver and merge.autoStash and rebase.autoStash go into this',
        'repository’s .git/config (they apply to every file of the clone); without a terminal it lists that as the',
        'command to run. It says, and does not do, what a plugin a host keeps needs: the host updates it.',
        'A run that finished writes the version it brought things to into this machine’s state file.',
      ].join('\n'),
    )
    .action(async (options: { dryRun?: boolean }) => {
      await runTheUpgrade(wiring, { dryRun: options.dryRun === true });
    });
  return readsTheRecord(verb);
}
