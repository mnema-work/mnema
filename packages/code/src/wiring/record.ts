/**
 * The `mnema record` wiring: what it declares, and what it prints.
 *
 * A group of three acts on the record as git holds it. `pull` is `git pull` over tails that grew here
 * and are not committed yet (`commands/record-pull.ts`); `commit` cuts the committed tree at a
 * signed checkpoint onto a branch of its own for a pull request (`commands/record-commit.ts`);
 * `merge-tail` is the merge driver git calls
 * for a tail's files (`commands/record-merge-tail.ts`), by `pull` on its own command line, or by
 * every merge once a person wrote the setting with `mnema doctor --fix merge-driver`.
 *
 * Declared `mutates`: `pull` changes the working tree, `commit` makes a branch, and `merge-tail`
 * writes the file git hands it,
 * and a read-only session (`repl`) must not be offered either.
 */

import type { Command } from 'commander';
import type { RecordCommitRefused } from '../commands/record-commit.js';
import { fact } from '../presentation/detail.js';
import { here } from './context.js';
import { nameRefusals } from './no-such-decision.js';
import { onOneLine } from './on-one-line.js';
import { reportRefusal } from './report.js';
import { type Declared, mutatesTheRecord, type Wiring } from './verb.js';
import { DEFAULT_REQUIREMENT, treeHeadline } from './verify.js';

/** At most this many paths are named in one refusal; the count says the rest. */
const NAMED = 10;

/** Up to {@link NAMED} paths, and how many more there are. */
function someOf(paths: readonly string[]): string {
  const named = paths.slice(0, NAMED).join(', ');
  return paths.length > NAMED ? `${named} and ${paths.length - NAMED} more` : named;
}

/** What each refusal of a cut says: the sentences `record commit` and `record publish` share. */
function commitRefusals(refused: RecordCommitRefused): Record<string, string> {
  return {
    NOT_A_REPOSITORY: 'The record here is not inside a git repository.',
    A_LINK:
      refused.reason === 'A_LINK'
        ? onOneLine`Nothing was made: these are symbolic links where the record keeps files, and a link is not followed into a commit: ${someOf(refused.paths)}.`
        : '',
    NO_REMOTE:
      refused.reason === 'NO_REMOTE'
        ? refused.remotes.length === 0
          ? 'This repository has no remote to open a pull request on: `git remote add origin <address>` names one.'
          : onOneLine`This repository has several remotes (${refused.remotes.join(', ')}), and the current branch follows none of them: \`git branch --set-upstream-to <remote>/<branch>\` names the one.`
        : '',
    NO_DEFAULT_BRANCH:
      refused.reason === 'NO_DEFAULT_BRANCH'
        ? onOneLine`This clone does not know which branch ${refused.remote} calls its default, and reading it would reach the network: \`git remote set-head ${refused.remote} --auto\` reads it, or \`git remote set-head ${refused.remote} <branch>\` names it.`
        : '',
    NO_SUCH_DESTINATION:
      refused.reason === 'NO_SUCH_DESTINATION'
        ? onOneLine`This clone does not hold ${refused.remote}/${refused.branch}, and reading it would reach the network: \`git remote update ${refused.remote}\` reads it.`
        : '',
    NOT_A_PREFIX:
      refused.reason === 'NOT_A_PREFIX'
        ? `Nothing was made: the base does not hold the start of the record here. ${refused.found.map((one) => one.said).join(' ')} Bring the base in with \`mnema record pull\` first.`
        : '',
    ...(refused.reason === 'NO_SUCH_DECISION' || refused.reason === 'AMBIGUOUS_LABEL'
      ? nameRefusals(refused)
      : {}),
    NOT_COVERED:
      refused.reason === 'NOT_COVERED'
        ? onOneLine`No signed checkpoint of the committed tree here covers the recording of ${refused.typed} yet, so no cut ends with it.`
        : '',
    GIT_FAILED:
      refused.reason === 'GIT_FAILED'
        ? `Git refused to build the commit, and no branch was made: ${refused.said}`
        : '',
    DOES_NOT_VERIFY:
      refused.reason === 'DOES_NOT_VERIFY'
        ? `The cut does not verify, and no branch was made: ${refused.said.join('; ')}.`
        : '',
  };
}

/** Registers `mnema record` on the program. */
export function registerRecord(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  const group = program
    .command('record')
    .description(
      'pull the record over events not yet committed, commit them for a pull request, and merge its tails for git',
    );

  group
    .command('pull')
    .description('git pull over tails grown here and not yet committed')
    .addHelpText(
      'after',
      [
        '',
        'It refuses, writing nothing, when a file outside .mnema/ has changes, or when a tail file',
        'here and on the branch followed is not one the start of the other (a fork), naming each.',
        'Then it runs `git pull --autostash` with the mnema merge driver given on that one command',
        'line, puts back a new tail git did not track yet, and verifies the record. It writes no',
        'git configuration.',
      ].join('\n'),
    )
    .action(async () => {
      const { driverCommand, runRecordPull } = await import('../commands/record-pull.js');
      const result = runRecordPull({
        ...here(),
        processEnv: process.env,
        driver: driverCommand(process.execPath, process.argv[1] ?? ''),
        requirement: DEFAULT_REQUIREMENT,
      });
      if (!result.ok) {
        reportRefusal(wiring, result, {
          NOT_A_REPOSITORY: 'The record here is not inside a git repository.',
          NO_UPSTREAM:
            'This branch follows no remote branch: `git branch --set-upstream-to <remote>/<branch>` names one.',
          CHANGES_OUTSIDE_THE_RECORD:
            result.reason === 'CHANGES_OUTSIDE_THE_RECORD'
              ? `Files outside the record have changes (${someOf(result.paths)}): commit or stash them, then run it again; it pulls over the record's own events only.`
              : '',
          FETCH_FAILED:
            result.reason === 'FETCH_FAILED'
              ? `Reading the branch followed from its remote failed, and nothing was changed: ${result.said}`
              : '',
          NOT_A_PREFIX:
            result.reason === 'NOT_A_PREFIX'
              ? `Nothing was pulled or written: ${result.found.map((one) => one.said).join(' ')}`
              : '',
        });
        return;
      }
      const failed = result.pulled.status !== 0 || result.unresolved !== undefined;
      if (failed) {
        for (const line of result.pulled.said.split('\n')) {
          if (line !== '') io.err(render(fact(line)));
        }
      }
      for (const path of result.restored) {
        io.out(
          render(
            fact(
              onOneLine`${path}: put back as this checkout held it, the longer side or the only one`,
            ),
          ),
        );
      }
      if (result.keptAside !== undefined) {
        io.err(
          render(
            fact(
              onOneLine`kept in ${result.keptAside.dir}, since the pull left another side there: ${result.keptAside.paths.join(', ')}`,
            ),
          ),
        );
      }
      if (result.unresolved !== undefined) {
        const { conflicted, stashKept } = result.unresolved;
        if (conflicted.length > 0) {
          io.err(
            render(
              fact(
                onOneLine`git pull from ${result.upstream} left these files in conflict: ${someOf(conflicted)}; resolve them, then commit or check them out.`,
              ),
            ),
          );
        }
        if (stashKept) {
          io.err(
            render(
              fact(
                'the local changes git set aside for the pull are still in its stash (`git stash list`); `git stash drop` once they are resolved.',
              ),
            ),
          );
        }
        io.fail();
        return;
      }
      if (result.pulled.status !== 0) {
        io.err(
          render(
            fact(onOneLine`git pull from ${result.upstream} failed; see what git said above.`),
          ),
        );
        io.fail();
        return;
      }
      io.out(render(fact(onOneLine`Pulled ${result.upstream}.`)));
      if (result.verdict === undefined) return;
      for (const tree of result.verdict.trees) io.out(render(treeHeadline(tree, 0)));
      if (!result.verdict.record.ok || !result.verdict.requirementMet) io.fail();
    });

  group
    .command('commit')
    .description('commit the signed record to a branch for a pull request')
    .option('--through <decision>', 'cut the tail that records this decision where it is covered')
    .option('--json', 'emit what was cut and the commands to run as JSON')
    .addHelpText(
      'after',
      [
        '',
        "It builds a commit on the remote's default branch as this clone last read it, without",
        'touching the working tree, the index or HEAD: each tail of .mnema/ cut through its last',
        'signed checkpoint, with the key files the cut names; nothing of the private tree. It',
        'verifies that tree, with --since the base, before it makes the branch, then prints the',
        'git push and the command that opens the pull request. It pushes nothing.',
      ].join('\n'),
    )
    .action(async (opts: { through?: string; json?: boolean }) => {
      const { runRecordCommit } = await import('../commands/record-commit.js');
      const result = runRecordCommit(
        { ...here(), processEnv: process.env, now: Date.now() },
        opts.through !== undefined ? { through: opts.through } : {},
      );
      if (!result.ok) {
        reportRefusal(wiring, result, commitRefusals(result));
        return;
      }
      if (opts.json === true) {
        io.out(JSON.stringify(result, null, 2));
        return;
      }
      const { base } = result;
      if (base.hoursOld !== undefined && base.hoursOld >= 1) {
        io.err(
          render(
            fact(
              onOneLine`${base.ref} was last updated here ${base.hoursOld} h ago: \`git remote update ${base.remote}\` reads it again, and this cut is made on top of it as it is.`,
            ),
          ),
        );
      } else if (base.hoursOld === undefined) {
        io.err(
          render(
            fact(
              onOneLine`git keeps no date of when ${base.ref} was last updated here: \`git remote update ${base.remote}\` reads it again.`,
            ),
          ),
        );
      }
      if (result.kind === 'nothing') {
        io.out(
          render(
            fact(
              onOneLine`Nothing to commit: ${base.ref} already holds the record here through the last signed checkpoint of each tail.`,
            ),
          ),
        );
      } else {
        for (const cut of result.tails) {
          io.out(
            render(
              fact(
                onOneLine`tail ${cut.tail}: ${cut.events} event(s), through seq ${cut.throughSeq}; ${cut.left} above the cut`,
              ),
            ),
          );
        }
        for (const decision of result.decisions) {
          io.out(render(fact(onOneLine`${decision.adr} (${decision.state}): ${decision.title}`)));
        }
      }
      if (result.left.events > 0 || result.left.files.length > 0) {
        io.out(
          render(
            fact(
              onOneLine`left out: ${result.left.events} event(s) above the cut${result.left.files.length > 0 ? `; files git would see as changed, not part of the cut: ${someOf(result.left.files)}` : ''}`,
            ),
          ),
        );
      }
      if (result.kind === 'nothing') return;
      io.out(
        render(
          fact(
            result.kind === 'exists'
              ? onOneLine`A branch of this cut is there already, made nothing: ${result.branch}.`
              : onOneLine`Made ${result.branch} on ${base.ref}, verified with verify --since ${base.ref}; nothing was pushed.`,
          ),
        ),
      );
      io.out(render(fact(onOneLine`next: ${result.next.push}`)));
      io.out(render(fact(onOneLine`then: ${result.next.open}`)));
    });

  group
    .command('publish')
    .description('push the record branch and open its pull request, to a destination you name')
    .option('--to <remote/branch>', 'the branch the pull request asks to merge into, on its remote')
    .option('--through <decision>', 'cut the tail that records this decision where it is covered')
    .option('--json', 'emit what was published as JSON')
    .addHelpText(
      'after',
      [
        '',
        'Off until `mnema switch on record-publish` (recorded for this machine only). It makes what',
        '`mnema record commit` makes, on top of the remote-tracking ref you name (the destination is',
        'never deduced from HEAD), then pushes that branch alone, without force, and opens the pull',
        'request on GitHub through `gh`. It refuses, before it cuts anything, when this repository',
        'sets no `user.email` of its own or sets the global one, and when a pull request that',
        'changes only the record is open into the destination: it says how long ago it was opened,',
        'and that it has stalled past 24 hours. It never merges.',
      ].join('\n'),
    )
    .action(async (opts: { to?: string; through?: string; json?: boolean }) => {
      const { runRecordPublish, STALLED_AFTER_HOURS } = await import(
        '../commands/record-publish.js'
      );
      const result = runRecordPublish(
        { ...here(), processEnv: process.env, now: Date.now() },
        {
          to: opts.to,
          ...(opts.through !== undefined ? { through: opts.through } : {}),
        },
      );
      if (!result.ok) {
        if (result.reason === 'CUT_REFUSED') {
          reportRefusal(wiring, result.refused, commitRefusals(result.refused));
          return;
        }
        reportRefusal(wiring, result, {
          NOT_A_REPOSITORY: 'The record here is not inside a git repository.',
          SWITCH_OFF:
            'Publishing the record is off on this machine: `mnema switch on record-publish` turns it on, for this machine only.',
          NO_DESTINATION:
            result.reason === 'NO_DESTINATION'
              ? result.typed === undefined
                ? onOneLine`Name the branch the pull request asks to merge into, with \`--to <remote>/<branch>\`${result.remotes.length > 0 ? ` (the remotes here: ${result.remotes.join(', ')})` : ''}.`
                : onOneLine`${result.typed} is not a branch of a remote of this repository${result.remotes.length > 0 ? ` (the remotes here: ${result.remotes.join(', ')})` : ''}: name it as \`--to <remote>/<branch>\`.`
              : '',
          NO_PUBLIC_IDENTITY:
            result.reason === 'NO_PUBLIC_IDENTITY'
              ? result.why === 'unset'
                ? 'Nothing was made: this repository sets no e-mail of its own (`git config user.email <address>` in it), and a commit that is pushed carries its author’s e-mail for good.'
                : 'Nothing was made: the e-mail this repository sets is the global one, and the one a pull request publishes is the repository’s own (`git config user.email <address>` in it).'
              : '',
          NOT_GITHUB:
            result.reason === 'NOT_GITHUB'
              ? onOneLine`Nothing was made: the address of ${result.remote} is not GitHub's, and the pull requests are read and opened through \`gh\`. By hand: check that no record pull request is open, then \`mnema record commit\` and what it prints.`
              : '',
          ADDRESSES_DIFFER:
            result.reason === 'ADDRESSES_DIFFER'
              ? onOneLine`Nothing was made: the address ${result.remote} pushes to and the address it reads from name different repositories, and the pull request is asked of the one the push reaches. Make them name the same one (\`git config remote.${result.remote}.pushurl\`).`
              : '',
          GH_ABSENT:
            'Nothing was made: `gh` is not installed here, and an open pull request of the record is read through it. By hand: check that no record pull request is open, then `mnema record commit` and what it prints.',
          GH_FAILED:
            result.reason === 'GH_FAILED'
              ? `Nothing was made: \`gh\` did not list the open pull requests (${result.said}).`
              : '',
          PULL_REQUEST_OPEN:
            result.reason === 'PULL_REQUEST_OPEN'
              ? onOneLine`Nothing was made: the pull request ${result.pullRequest.url} changes only the record and is open, for ${result.pullRequest.hoursOpen} h; a second cut would carry its lines again.${result.pullRequest.stalled ? ` It has stalled: it is open past ${STALLED_AFTER_HOURS} h, and it needs merging or closing before the record goes on.` : ''}`
              : '',
          AUTHOR_NOT_PUBLIC:
            result.reason === 'AUTHOR_NOT_PUBLIC'
              ? onOneLine`The branch ${result.branch} was made here and carries an author or a committer e-mail other than this repository's own, so nothing was pushed: delete it (\`git branch -D ${result.branch}\`) and run this again without \`GIT_AUTHOR_EMAIL\` or \`GIT_COMMITTER_EMAIL\` set.`
              : '',
          PUSH_FAILED:
            result.reason === 'PUSH_FAILED'
              ? onOneLine`The branch ${result.branch} was made here and git did not push it: ${result.said}. Running this again pushes it.`
              : '',
          PULL_REQUEST_NOT_OPENED:
            result.reason === 'PULL_REQUEST_NOT_OPENED'
              ? onOneLine`The branch ${result.branch} is pushed and \`gh\` did not open its pull request: ${result.said}. Running this again opens it.`
              : '',
        });
        return;
      }
      if (opts.json === true) {
        io.out(JSON.stringify(result, null, 2));
        return;
      }
      if (result.kind === 'nothing') {
        io.out(
          render(
            fact(
              onOneLine`Nothing to publish: ${result.base.ref} already holds the record here through the last signed checkpoint of each tail.`,
            ),
          ),
        );
        return;
      }
      io.out(
        render(
          fact(
            onOneLine`Pushed ${result.branch} (${result.events} event(s)) and opened ${result.url} into ${result.base.ref}; nothing was merged.`,
          ),
        ),
      );
    });

  group
    .command('merge-tail')
    .description("the merge driver git runs for a tail's files")
    .argument('<ancestor>', 'the common ancestor git hands (%O); not read')
    .argument('<ours>', 'our side (%A), where the result is written')
    .argument('<theirs>', 'their side (%B)')
    .argument('[path]', 'the path git is merging (%P), named when the sides fork')
    .action(async (_ancestor: string, ours: string, theirs: string, path: string | undefined) => {
      const { forkSentence, mergeTailFiles } = await import('../commands/record-merge-tail.js');
      const done = mergeTailFiles({ ours, theirs });
      if (!done.ok) {
        io.err(render(fact(forkSentence(path ?? ours, done.line))));
        io.fail();
      }
    });

  return mutatesTheRecord(group);
}
