/**
 * The `mnema backup` wiring: what it declares, and what it prints.
 *
 * Three acts on a project's backup in a folder: `setup` says which folder keeps it, `run` copies
 * the trees into it, `status` says how far the copy is from them. None of them records anything:
 * the verb reads the record and writes a folder, so it is declared as a read.
 *
 * THE FOLDER KEEPS THE TEXT IN CLEAR, and `setup` says so before it assigns anything (ADR-387): the
 * person confirms it by typing `yes` at the question, at a terminal and nowhere else. There is no
 * flag that answers it: without a terminal nobody answered, nothing is assigned, and the refusal
 * says the command for the person to run (as `stack hook` does).
 */

import type { Command } from 'commander';
import { fact } from '../presentation/detail.js';
import { here } from './context.js';
import { writeLines } from './io.js';
import { onOneLine } from './on-one-line.js';
import { reportRefusal } from './report.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** The sentence a person confirms, and the page that says what to do about it. */
export const KEPT_IN_CLEAR =
  'This destination keeps the text in clear: the record and its public keys are copied as they are, with no encryption, and whoever can read the folder can read them. Keep it on an encrypted volume if that matters.';

const REFUSALS: Readonly<Record<string, string>> = {
  NO_DESTINATION:
    'This project has no folder for its backup, and none is taken from another project: run `mnema backup setup <folder>`.',
  NO_GLOBAL_DESTINATION:
    'The global tree has no folder for its backup, and it takes none from a project: run `mnema backup setup --global <folder>`.',
};

/** Registers `mnema backup` on the program. */
export function registerBackup(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  const backup = program
    .command('backup')
    .description(
      "copy this project's trees into a folder, and say how far the copy is (records nothing)",
    )
    .addHelpText(
      'after',
      [
        '',
        'The copy is a folder per project, kept under the name of its record: the tails up to their',
        'last complete line and the public keys, and nothing else. The private tree is always copied;',
        'the public tree only where the project is not in git, whose history is its own backup. No',
        'private key is copied: a run is refused whole if a file it would copy holds one, and so is a',
        'symbolic link in the tree or in the folder. A copy only grows. The folder keeps the text in',
        'clear, which `setup` asks a person to confirm at a terminal. A machine can have a folder per project; a project has the one it was set up with.',
        "The machine's global tree, which mixes the memory of every project, is never part of a project's",
        'backup: `--global` copies it, and only it, into the folder `setup --global` gave it, as',
        '<folder>/global/.',
      ].join('\n'),
    );

  backup
    .command('setup')
    .description(
      "say which folder keeps this project's backup, after a person confirms at a terminal that it keeps the text in clear",
    )
    .argument('<folder>', 'the folder (outside the working tree, the record and the git directory)')
    .option('--global', "assign the folder to the machine's global tree instead of this project")
    .action(async (folder: string, opts: { global?: boolean }) => {
      const { checkBackupSetup, checkGlobalBackupSetup, runBackupSetup, runGlobalBackupSetup } =
        await import('../commands/backup.js');
      const toGlobal = opts.global === true;
      const checked = toGlobal
        ? checkGlobalBackupSetup(here(), folder)
        : checkBackupSetup(here(), folder);
      if (!checked.ok) {
        reportRefusal(wiring, checked, REFUSALS);
        return;
      }
      if (io.aPersonIsHere !== true || io.ask === undefined) {
        const command = toGlobal
          ? 'mnema backup setup --global <folder>'
          : 'mnema backup setup <folder>';
        reportRefusal(wiring, {
          reason: 'NOT_AT_A_TERMINAL',
          message: `${KEPT_IN_CLEAR} A person confirms that at a terminal, and nothing here can answer for them: run \`${command}\` in a terminal. Nothing was assigned.`,
        });
        return;
      }
      io.out(render(fact(KEPT_IN_CLEAR, 0)));
      const answer = (await io.ask('Type yes to use this folder: ')).trim().toLowerCase();
      if (answer !== 'yes') {
        io.out('Nothing was assigned.');
        return;
      }
      if (toGlobal) {
        const result = runGlobalBackupSetup(here(), folder);
        if (!result.ok) {
          reportRefusal(wiring, result, REFUSALS);
          return;
        }
        io.out(onOneLine`The backup of the global tree is kept in ${result.destination}`);
        if (result.replaced !== undefined && result.replaced !== result.destination) {
          io.out(
            render(fact(onOneLine`it was ${result.replaced}; what is there is left as it is`)),
          );
        }
        io.out(render(fact('`mnema backup run --global` copies it')));
        return;
      }
      const result = runBackupSetup(here(), folder);
      if (!result.ok) {
        reportRefusal(wiring, result, REFUSALS);
        return;
      }
      io.out(
        onOneLine`The backup of record ${result.record.slice(0, 12)}... is kept in ${result.destination}`,
      );
      if (result.replaced !== undefined && result.replaced !== result.destination) {
        io.out(render(fact(onOneLine`it was ${result.replaced}; what is there is left as it is`)));
      }
      io.out(render(fact('`mnema backup run` copies it')));
    });

  backup
    .command('run')
    .description("copy this project's trees into its folder, or with --global only the global tree")
    .option(
      '--global',
      "copy the machine's global tree, and only it, into the folder it was assigned",
    )
    .action(async (opts: { global?: boolean }) => {
      const { runBackupRun, runGlobalBackupRun } = await import('../commands/backup.js');
      if (opts.global === true) {
        const result = runGlobalBackupRun(here());
        if (!result.ok) {
          reportRefusal(wiring, result, REFUSALS);
          return;
        }
        io.out(onOneLine`Backed up the global tree to ${result.destination}`);
        io.out(
          render(
            fact(
              result.copied === undefined
                ? 'global tree: none on this machine yet'
                : `global tree: ${result.copied.files} file(s) held, ${result.copied.written} written or grown`,
            ),
          ),
        );
        return;
      }
      const result = runBackupRun(here());
      if (!result.ok) {
        reportRefusal(wiring, result, REFUSALS);
        return;
      }
      io.out(onOneLine`Backed up record ${result.record.slice(0, 12)}... to ${result.destination}`);
      for (const one of result.copied) {
        io.out(
          render(
            fact(`${one.tree} tree: ${one.files} file(s) held, ${one.written} written or grown`),
          ),
        );
      }
      if (result.noPrivateTree) io.out(render(fact('private tree: none on this machine yet')));
      if (result.publicIsInGit) io.out(render(fact('public tree: kept by git, not copied')));
    });

  backup
    .command('status')
    .description("say where this project's backup is and how far it is from the trees")
    .option('--global', "say it of the machine's global tree instead of this project")
    .option('--json', 'emit the faithful reading as JSON')
    .action(async (opts: { global?: boolean; json?: boolean }) => {
      const { runBackupStatus, runGlobalBackupStatus } = await import('../commands/backup.js');
      if (opts.global === true) {
        const result = runGlobalBackupStatus(here());
        if (!result.ok) {
          reportRefusal(wiring, result, REFUSALS);
          return;
        }
        if (opts.json === true) {
          const { ok: _ok, ...reading } = result;
          io.out(JSON.stringify(reading, null, 2));
          return;
        }
        const lines = [fact(onOneLine`Backup of the global tree in ${result.destination}`, 0)];
        const one = result.standing;
        if (one === undefined) {
          lines.push(fact('global tree: none on this machine yet'));
        } else {
          const when = one.copiedAt === undefined ? 'never copied' : `last copied ${one.copiedAt}`;
          const behind = one.behind === 0 ? 'nothing to add' : `${one.behind} file(s) to copy`;
          lines.push(fact(`global tree: ${when}; ${behind}`));
          if (one.diverged > 0) {
            lines.push(
              fact(
                `global tree: ${one.diverged} file(s) of the copy are not the start of the tree's, and the next run refuses them`,
              ),
            );
          }
        }
        lines.push(fact('the private key is not copied: it stays on this machine'));
        writeLines(
          io,
          lines.map((line) => render(line)),
        );
        return;
      }
      const result = runBackupStatus(here());
      if (!result.ok) {
        reportRefusal(wiring, result, REFUSALS);
        return;
      }
      if (opts.json === true) {
        const { ok: _ok, ...reading } = result;
        io.out(JSON.stringify(reading, null, 2));
        return;
      }
      const lines = [
        fact(
          onOneLine`Backup of record ${result.record.slice(0, 12)}... in ${result.destination}`,
          0,
        ),
      ];
      for (const one of result.trees) {
        const when = one.copiedAt === undefined ? 'never copied' : `last copied ${one.copiedAt}`;
        const behind = one.behind === 0 ? 'nothing to add' : `${one.behind} file(s) to copy`;
        lines.push(fact(`${one.tree} tree: ${when}; ${behind}`));
        if (one.diverged > 0) {
          lines.push(
            fact(
              `${one.tree} tree: ${one.diverged} file(s) of the copy are not the start of the tree's, and the next run refuses them`,
            ),
          );
        }
      }
      if (result.noPrivateTree) lines.push(fact('private tree: none on this machine yet'));
      if (result.publicIsInGit) lines.push(fact('public tree: kept by git, not copied'));
      lines.push(fact('the private key is not copied: it stays on this machine'));
      writeLines(
        io,
        lines.map((line) => render(line)),
      );
    });

  return readsTheRecord(backup);
}
