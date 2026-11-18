/**
 * The `mnema backup` wiring: what it declares, and what it prints.
 *
 * Five acts on a project's backup in a folder: `setup` says which folder keeps it, `run` copies
 * the trees into it, `status` says how far the copy is from them, `verify` reads the copy as a record
 * and sets it against the trees, and `restore` puts a copy back without overwriting anything. None of
 * them records anything: the verb reads the record and writes a folder (or a tree that lost files),
 * so it is declared as a read.
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

/**
 * WHAT A RESTORE DOES NOT BRING BACK, said at the end of every restore and of its dry run: the text
 * of the record, never the key that signed it, and never what the tree wrote after the copy.
 */
export const WHAT_RESTORE_DOES_NOT_BRING = [
  'a restore puts back the text the copy holds, and not the key that signed it: if the key was lost with the machine, the next write signs with a new key, and the tree then counts you twice',
  'what the tree wrote after the copy was made is not in the copy, and a restore cannot bring it back',
  'the first write after a restore opens a tail of its own, beside the restored ones: a restored tail is not continued',
];

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
        "`verify` reads the copy as a record (with this mnema's reader) and says how it stands against the trees; `restore` puts it",
        'back into a tree that lost files, and never over a file the tree holds.',
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

  backup
    .command('verify')
    .description(
      "read each copy as a record and say how it stands against this project's trees, which it does not change",
    )
    .option('--json', 'emit the faithful reading as JSON')
    .action(async (opts: { json?: boolean }) => {
      const { runBackupVerify } = await import('../commands/backup.js');
      const result = runBackupVerify(here());
      if (!result.ok) {
        reportRefusal(wiring, result, REFUSALS);
        return;
      }
      if (opts.json === true) {
        const { ok: _ok, ...reading } = result;
        io.out(JSON.stringify(reading, null, 2));
        if (!result.sound) io.fail();
        return;
      }
      const lines = [
        fact(
          onOneLine`Backup of record ${result.record.slice(0, 12)}... in ${result.destination}`,
          0,
        ),
      ];
      for (const one of result.trees) {
        if ('noCopy' in one) {
          lines.push(fact(`${one.tree} tree: no copy, so nothing to verify`));
          continue;
        }
        const reading = one.reading;
        const t = one.tree;
        const when = reading.copiedAt === undefined ? 'no manifest' : `copied ${reading.copiedAt}`;
        // Everything below that came out of a file (a name, a date, what a reader printed) goes through
        // `onOneLine`: a file of the copy can hold a line break, and a line is one line.
        lines.push(fact(onOneLine`${t} tree: ${reading.files} file(s) in the copy, ${when}`));
        const refused = reading.reader.ok ? '' : 'REFUSED, ';
        lines.push(
          fact(onOneLine`${t} tree: read by this mnema: ${refused}${reading.reader.summary}`),
        );
        lines.push(
          fact(
            onOneLine`${t} tree: ONE reader read this copy. The second reader is a Python program of the source repository: \`python3 packages/chain/verifier/mnema_verify.py record ${reading.folder}\` runs it by hand`,
          ),
        );
        for (const path of reading.missing) {
          lines.push(
            fact(
              onOneLine`${t} tree: ${path} is listed by the copy's manifest and is not whole in it`,
            ),
          );
        }
        const standing = reading.standing;
        for (const cut of standing.cut) {
          lines.push(
            fact(
              onOneLine`${t} tree: ${cut.path} holds ${cut.tree} entries in the tree and ${cut.copy} in the copy: the tree is cut, or the copy is of a longer one; \`mnema backup restore\` does not overwrite it`,
            ),
          );
        }
        for (const lost of standing.lost) {
          lines.push(fact(onOneLine`${t} tree: ${lost} is in the copy and not in the tree`));
        }
        for (const forked of standing.forked) {
          lines.push(
            fact(
              onOneLine`${t} tree: ${forked.path} is not the start of the other (tree ${forked.tree} entries, copy ${forked.copy}): a fork, or a cut, and no side is taken`,
            ),
          );
        }
        // The entries a copy lacks, tail by tail: a count of files says little about what a loss would be.
        const lacking = new Map<string, number>();
        for (const one of standing.behind) {
          if (one.entries <= 0) continue;
          const tail = one.path.split('/')[1] ?? one.path;
          lacking.set(tail, (lacking.get(tail) ?? 0) + one.entries);
        }
        for (const [tail, entries] of lacking) {
          lines.push(
            fact(
              onOneLine`${t} tree: the copy lacks ${entries} entries of the tail ${tail}, which the tree holds`,
            ),
          );
        }
        lines.push(
          fact(
            standing.behind.length === 0
              ? `${t} tree: the copy is as far as the tree`
              : `${t} tree: the copy is BEHIND: ${standing.behind.length} file(s) of the tree hold more than it; \`mnema backup run\` brings it up`,
          ),
        );
      }
      lines.push(
        fact(
          result.sound
            ? 'the copy is a record this mnema accepts, and the tree is not shown cut'
            : 'the copy is not sound, or the tree is shown cut, lost or forked from it: see above',
        ),
      );
      writeLines(
        io,
        lines.map((line) => render(line)),
      );
      if (!result.sound) io.fail();
    });

  backup
    .command('restore')
    .description('put a copy back into the trees that lost files, never over a file the tree holds')
    .option('--dry-run', 'say what would be put back, and put nothing')
    .action(async (opts: { dryRun?: boolean }) => {
      const { runBackupRestore } = await import('../commands/backup.js');
      const result = runBackupRestore(here(), opts.dryRun === true);
      if (!result.ok) {
        reportRefusal(wiring, result, REFUSALS);
        return;
      }
      const verb = result.dryRun ? 'would put back' : 'put back';
      const heading = result.dryRun ? 'Dry run: nothing was written. Restoring' : 'Restored';
      io.out(
        onOneLine`${heading} record ${result.record.slice(0, 12)}... from ${result.destination}`,
      );
      for (const one of result.trees) {
        const t = one.tree;
        const copied =
          one.copiedAt === undefined ? 'a copy with no manifest' : `the copy of ${one.copiedAt}`;
        // What was written, when something was; the plan only on a dry run.
        const wrote = one.restored?.files ?? one.placing.length;
        const newTails = one.restored?.tails ?? one.newTails;
        const tails =
          newTails.length === 0 ? '' : ` (${newTails.length} tail(s) the tree did not have)`;
        io.out(render(fact(onOneLine`${t} tree: ${copied} ${verb} ${wrote} file(s)` + tails)));
        for (const path of one.liveWins) {
          io.out(
            render(
              fact(
                onOneLine`${t} tree: ${path} holds more in the tree than in the copy: the tree's is kept`,
              ),
            ),
          );
        }
        for (const path of one.kept) {
          io.out(
            render(
              fact(onOneLine`${t} tree: ${path} holds other bytes in the tree: left as it is`),
            ),
          );
        }
      }
      for (const tree of result.noCopy) {
        io.out(render(fact(`${tree} tree: no copy, nothing to restore`)));
      }
      for (const words of WHAT_RESTORE_DOES_NOT_BRING) io.out(render(fact(words)));
      if (!result.dryRun) io.out(render(fact('`mnema backup verify` reads the result')));
    });

  return readsTheRecord(backup);
}
