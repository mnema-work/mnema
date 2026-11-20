// @reads-the-tree
/**
 * NO NEW SILENT CATCH (ADR-612): a catch that drops the error it caught and goes on is counted, and
 * the count may only fall.
 *
 * A catch is silent when its body neither rethrows nor uses the error (see `silentCatches`). The
 * source holds 327 of them in every package's `src` and `plugin/hooks`, each one written with a good
 * reason and none of them seen by anyone but its author: the count grew by 128 clauses in the week
 * before this guard, with every new one commented. So the convention could not hold the line.
 *
 * THE LIST IS A RATCHET, not a verdict on any of them. {@link FROZEN} holds today's, per file, by
 * what the catch's body does (comments and strings gone, whitespace collapsed) and how many times
 * a file has it, so a line number drifting or a function moving does not move it. This file is red
 * for:
 *
 * - a silent catch the list does not have, named by file:line: handle the error (name it and use
 *   it, or rethrow it) or, where the silence is the design, say so in {@link EXEMPT} with the reason;
 * - a frozen entry the source no longer has (the catch was fixed or deleted): drop it from the list,
 *   so the count only falls and the next one cannot hide behind the room this one left.
 *
 * Editing the body of a frozen catch changes what it does, so its entry leaves with it: if it is
 * still silent it is a new silent catch and this file asks again.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sourceFiles } from './support/reading-source.js';
import { silentCatches } from './support/silent-catches.js';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Files whose silent catches are by design and outside the count, each with its reason. */
const EXEMPT: Readonly<Record<string, string>> = {};

/** Silent catches today: file, then the body of the catch, then how many. It may only shrink. */
const FROZEN: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'packages/action/src/record.ts': {
    'continue;': 2,
    '': 1,
  },
  'packages/action/src/world.ts': {
    'return false;': 1,
  },
  'packages/chain/src/chain/backup.ts': {
    'return { fingerprint, usable: false, fault: };': 1,
    'return null;': 1,
    'return false;': 1,
  },
  'packages/chain/src/chain/checkpoint.ts': {
    'return false;': 1,
  },
  'packages/chain/src/chain/citation-index.ts': {
    'return undefined;': 2,
    '': 1,
  },
  'packages/chain/src/chain/cited-heads.ts': {
    'return {};': 1,
    '': 1,
    'return undefined;': 1,
  },
  'packages/chain/src/chain/enrollment.ts': {
    'return false;': 2,
  },
  'packages/chain/src/chain/kept-head.ts': {
    'return undefined;': 2,
    '': 2,
  },
  'packages/chain/src/chain/key-protection.ts': {
    'return undefined;': 1,
  },
  'packages/chain/src/chain/keystore.ts': {
    'return undefined;': 1,
  },
  'packages/chain/src/chain/linked-write.ts': {
    'return;': 1,
  },
  'packages/chain/src/chain/migration.ts': {
    'return [];': 1,
    'return undefined;': 1,
    'return ;': 1,
  },
  'packages/chain/src/chain/pool.ts': {
    '': 2,
    'return undefined;': 2,
    'return false;': 1,
  },
  'packages/chain/src/chain/staging.ts': {
    'return [];': 1,
    '': 1,
  },
  'packages/chain/src/chain/store.ts': {
    'continue;': 1,
    'return said;': 1,
    'return -1;': 1,
    'return ;': 1,
    'return undefined;': 2,
  },
  'packages/chain/src/chain/tail-lock.ts': {
    '': 2,
    'return undefined;': 1,
    'return true;': 1,
  },
  'packages/chain/src/chain/tail-names.ts': {
    'return undefined;': 2,
    '': 1,
  },
  'packages/chain/src/chain/tail-repair.ts': {
    'checkpoint = undefined;': 1,
  },
  'packages/chain/src/chain/tailproof.ts': {
    'signatureOk = false;': 1,
  },
  'packages/chain/src/chain/witness-request.ts': {
    'return ;': 1,
    'return response;': 1,
  },
  'packages/chain/src/chain/witness.ts': {
    'return null;': 1,
  },
  'packages/chain/src/chain/writer.ts': {
    'return undefined;': 2,
    'continue;': 1,
    'return null;': 1,
    'return false;': 3,
    'return -1;': 1,
  },
  'packages/chain/src/events/parse.ts': {
    'roundTrip = null;': 1,
  },
  'packages/chain/src/events/stored-json.ts': {
    'return false;': 1,
    'return undefined;': 1,
  },
  'packages/code/src/agent-accepts.ts': {
    'return ;': 1,
  },
  'packages/code/src/an-altered-entry-stops-a-write.ts': {
    '': 1,
  },
  'packages/code/src/cli.ts': {
    'return false;': 1,
  },
  'packages/code/src/commands/after-a-write.ts': {
    'return silent([ ]);': 1,
    'return silent([ file ]);': 1,
    'return false;': 1,
    'continue;': 1,
  },
  'packages/code/src/commands/after-update.ts': {
    'return ;': 1,
    '': 1,
  },
  'packages/code/src/commands/before-a-write.ts': {
    'return silent([ ]);': 1,
    'return false;': 1,
    'taken.release();': 1,
    'return [];': 1,
  },
  'packages/code/src/commands/beside-a-write.ts': {
    'return silent([ ]);': 1,
  },
  'packages/code/src/commands/check.ts': {
    'return null;': 1,
  },
  'packages/code/src/commands/commit-hook.ts': {
    'return false;': 2,
  },
  'packages/code/src/commands/corrections.ts': {
    'return silent([ ]);': 1,
  },
  'packages/code/src/commands/decision-transition.ts': {
    'return ;': 1,
  },
  'packages/code/src/commands/decision.ts': {
    '': 1,
    'return addressOfferLines([], recorded, recorded.scope, );': 1,
  },
  'packages/code/src/commands/dispatched.ts': {
    'return path;': 1,
    'return undefined;': 2,
    '': 1,
    'continue;': 1,
  },
  'packages/code/src/commands/doctor-mcp.ts': {
    'return { kind: , why: };': 2,
  },
  'packages/code/src/commands/doctor-merge-driver.ts': {
    'return false;': 1,
  },
  'packages/code/src/commands/doctor.ts': {
    'return false;': 2,
    'return path;': 1,
    'return undefined;': 2,
    'return [];': 2,
  },
  'packages/code/src/commands/handback.ts': {
    'return [ HANDBACK_INFO ];': 1,
    'return silent([ ]);': 1,
  },
  'packages/code/src/commands/init.ts': {
    'return false;': 1,
  },
  'packages/code/src/commands/instructions.ts': {
    'return false;': 2,
    'return dir ;': 1,
    'return ;': 1,
    'return;': 1,
  },
  'packages/code/src/commands/key-request.ts': {
    'names = [];': 1,
    'continue;': 1,
  },
  'packages/code/src/commands/promote.ts': {
    'return path;': 1,
  },
  'packages/code/src/commands/record-commit.ts': {
    '': 1,
    'break;': 1,
  },
  'packages/code/src/commands/rules-file.ts': {
    'return ;': 1,
  },
  'packages/code/src/commands/settled.ts': {
    'return SILENT;': 1,
  },
  'packages/code/src/commands/site.ts': {
    'return ;': 1,
    'return { ok: false, reason: , message: input.head , };': 1,
  },
  'packages/code/src/commands/stack-index.ts': {
    'return false;': 1,
    'return no( FILE shown );': 2,
  },
  'packages/code/src/commands/stack-inspect.ts': {
    'return [];': 1,
    'return { ...base, state: as const };': 1,
    'state = ;': 1,
  },
  'packages/code/src/commands/stack-install.ts': {
    'continue;': 1,
    'return undefined;': 1,
    '': 1,
    'missing.push(file.path); continue;': 1,
    'break;': 1,
  },
  'packages/code/src/commands/stack-signature.ts': {
    'return undefined;': 1,
  },
  'packages/code/src/commands/stack-source.ts': {
    'return refused( );': 1,
    'return refused( source );': 1,
  },
  'packages/code/src/commands/summary.ts': {
    'unread.push( );': 2,
  },
  'packages/code/src/commands/tally.ts': {
    'return silent([ ]);': 1,
  },
  'packages/code/src/commands/the-record-page.ts': {
    'return false;': 3,
    '': 3,
  },
  'packages/code/src/commands/the-tools-that-rewrite-files.ts': {
    'return undefined;': 3,
    '': 1,
    'parsed = lintStagedYaml(text);': 1,
  },
  'packages/code/src/commands/verify-github.ts': {
    'return undefined;': 2,
  },
  'packages/code/src/commands/verify.ts': {
    'return path;': 1,
    'return result;': 1,
  },
  'packages/code/src/diagnostic-log.ts': {
    'return UNREADABLE;': 1,
    'return [];': 2,
    'return { offer: false };': 1,
  },
  'packages/code/src/env.ts': {
    'return undefined;': 1,
  },
  'packages/code/src/events-not-in-git.ts': {
    'return undefined;': 1,
  },
  'packages/code/src/file-behind-a-path.ts': {
    'return { path, exists: false };': 1,
    'return { path, exists: true, kind: };': 1,
    'return false;': 1,
  },
  'packages/code/src/git-log.ts': {
    'return null;': 1,
  },
  'packages/code/src/governed-tree.ts': {
    'return dirname(path);': 1,
    'return undefined;': 1,
    'target = undefined;': 1,
    'const parent = dirname(existing); if (parent === existing) return undefined; rest.unshift(basename(existing)); existing = parent;': 1,
    'skipped.push(prefix === ? : prefix); return;': 1,
  },
  'packages/code/src/host-memory.ts': {
    'return undefined;': 1,
    'return false;': 1,
  },
  'packages/code/src/inherited-record.ts': {
    'return { state: , why: POINTER_FILE };': 1,
    'return false;': 1,
    '': 2,
    'return { state: , pointer, why: };': 1,
    'return undefined;': 1,
  },
  'packages/code/src/init/detect.ts': {
    'return undefined;': 2,
    '': 1,
    'return false;': 2,
  },
  'packages/code/src/init/run.ts': {
    '': 1,
  },
  'packages/code/src/machine-state.ts': {
    'return UNREADABLE;': 1,
  },
  'packages/code/src/mcp/context.ts': {
    'return undefined;': 1,
  },
  'packages/code/src/mcp/server.ts': {
    '': 1,
  },
  'packages/code/src/mcp/session.ts': {
    'leftOpen.push(run.id);': 1,
  },
  'packages/code/src/mcp/tools.ts': {
    'return lines;': 1,
    'return ;': 1,
    'return false;': 1,
    'return [];': 1,
  },
  'packages/code/src/node-floor.ts': {
    'return undefined;': 1,
  },
  'packages/code/src/not-a-project.ts': {
    'unreadable += 1; continue;': 1,
    'unreadable += 1;': 1,
  },
  'packages/code/src/package-root.ts': {
    '': 1,
  },
  'packages/code/src/plugin-tree-hash.ts': {
    'return undefined;': 1,
  },
  'packages/code/src/program.ts': {
    '': 4,
  },
  'packages/code/src/repl/session.ts': {
    '': 1,
  },
  'packages/code/src/session-journal.ts': {
    'return undefined;': 2,
    '': 6,
    'try { if (Date.now() - statSync(guard).mtimeMs > LOCK_LEFT_MS) { rmSync(guard, { recursive: true, force: true }); } } catch { } return false;': 1,
    'return false;': 1,
    'held = takeOverALeftLock(lock); if (held) break; if (Date.now() > until) break; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);': 1,
    'return 0;': 1,
    'return { release: () => undefined };': 1,
    'continue;': 1,
  },
  'packages/code/src/sigstore/sign.ts': {
    'return {};': 1,
    '': 1,
  },
  'packages/code/src/site/browser/filters.ts': {
    'return [];': 1,
    '': 1,
  },
  'packages/code/src/the-persons-key-in-the-clear.ts': {
    'return undefined;': 1,
  },
  'packages/code/src/tool-calls.ts': {
    '': 1,
    'return { calls: [], passedOver: 0 };': 1,
    'return undefined;': 1,
  },
  'packages/code/src/tour/run.ts': {
    '': 1,
  },
  'packages/code/src/transcripts.ts': {
    'return;': 2,
    'return undefined;': 4,
    'return { end: start, size: -1 };': 1,
  },
  'packages/code/src/update-notice.ts': {
    'return false;': 1,
    '': 1,
    'return undefined;': 1,
  },
  'packages/code/src/what-the-session-did.ts': {
    'return -1;': 1,
  },
  'packages/code/src/wiring/commit-hook.ts': {
    '': 1,
  },
  'packages/code/src/wiring/written-before.ts': {
    'continue;': 1,
  },
  'packages/core/src/adr/bridges.ts': {
    'return [];': 1,
    'return { refused: };': 1,
    'refused.push({ path, code: }); continue;': 1,
    'return { read: [], refused: [{ path: file, code: }] };': 1,
  },
  'packages/core/src/adr/scan.ts': {
    'return [];': 1,
    'refused.push({ path, code: }); continue;': 1,
  },
  'packages/core/src/checks/checkers.ts': {
    'return false;': 1,
  },
  'packages/core/src/identity/handshake.ts': {
    'return null;': 4,
    'return false;': 1,
  },
  'packages/core/src/identity/membership.ts': {
    'return false;': 2,
  },
  'packages/core/src/identity/restore.ts': {
    'return null;': 1,
    'return false;': 1,
  },
  'packages/core/src/projections/cache-home.ts': {
    '': 1,
    'return Buffer.alloc(0);': 1,
  },
  'packages/core/src/projections/cache-meta.ts': {
    'return ;': 1,
    '': 1,
    'return undefined;': 2,
  },
  'packages/core/src/projections/cache.ts': {
    'return new ProjectionCache(openMemory(), layout, upcasters, false);': 1,
    '': 1,
  },
  'packages/core/src/projections/tree-index.ts': {
    'return ;': 2,
    'return undefined;': 2,
    '': 1,
  },
  'packages/core/src/topology/backup/aside.ts': {
    'return undefined;': 1,
    'return [];': 1,
  },
  'packages/core/src/topology/backup/copy.ts': {
    '': 1,
  },
  'packages/core/src/topology/backup/git-destination.ts': {
    'return false;': 1,
  },
  'packages/core/src/topology/backup/restore.ts': {
    'return undefined;': 1,
    '': 1,
    'return [];': 1,
  },
  'packages/core/src/topology/backup/verify.ts': {
    '': 1,
  },
  'packages/core/src/topology/base-branch.ts': {
    'return () => false;': 1,
    'return () => undefined;': 1,
    'return undefined;': 1,
    '': 1,
  },
  'packages/core/src/topology/git-place.ts': {
    'return found;': 1,
    '': 2,
    'return undefined;': 3,
  },
  'packages/core/src/topology/machinery-place.ts': {
    '': 1,
    'return false;': 1,
  },
  'packages/core/src/topology/private-tree-move.ts': {
    'continue;': 1,
    '': 1,
    'return [];': 1,
    'return false;': 1,
  },
  'packages/core/src/topology/private-tree.ts': {
    'const parent = dirname(head); if (parent === head) return path; rest.unshift(basename(head)); head = parent;': 1,
  },
  'packages/core/src/topology/resolve.ts': {
    '': 1,
    'return false;': 1,
  },
  'packages/core/src/workflow/identity-operations.ts': {
    'return refusal;': 1,
  },
  'packages/stacks/src/archive.ts': {
    'return { files: [], problems: [notAnArchive( )] };': 1,
  },
  'packages/stacks/src/manifest.ts': {
    'return i.test(text);': 1,
  },
  'packages/stacks/src/validate.ts': {
    'add( , , );': 1,
  },
  'packages/vscode/src/decision.ts': {
    'return failed( result.stdout.trimEnd() );': 1,
  },
  'packages/vscode/src/proposed.ts': {
    'return undefined;': 1,
  },
  'packages/vscode/src/rules.ts': {
    'return [];': 1,
  },
  'packages/vscode/src/stacks.ts': {
    'return undefined;': 1,
    'return [];': 1,
  },
  'packages/vscode/src/status.ts': {
    'return { kind: };': 1,
    'return [];': 1,
  },
  'packages/vscode/src/why.ts': {
    'return undefined;': 1,
  },
  'plugin/hooks/after-a-write.mjs': {
    '': 1,
  },
  'plugin/hooks/agent-dispatched.mjs': {
    'return ;': 1,
    '': 1,
  },
  'plugin/hooks/an-address-can-be-met.mjs': {
    'return true;': 1,
  },
  'plugin/hooks/choice-settled.mjs': {
    '': 1,
  },
  'plugin/hooks/edit-asks-a-person.mjs': {
    '': 2,
  },
  'plugin/hooks/edit-refuses-a-write.mjs': {
    '': 2,
  },
  'plugin/hooks/edit-rules-beside.mjs': {
    '': 1,
  },
  'plugin/hooks/hand-over.mjs': {
    'return null;': 1,
    'return ;': 1,
  },
  'plugin/hooks/session-compacted.mjs': {
    'return undefined;': 1,
    '': 1,
  },
  'plugin/hooks/session-corrections.mjs': {
    '': 1,
  },
  'plugin/hooks/session-recall.mjs': {
    'return undefined;': 1,
    '': 1,
  },
  'plugin/hooks/session-start.mjs': {
    '': 1,
  },
  'plugin/hooks/session-tally.mjs': {
    '': 1,
  },
  'plugin/hooks/subagent-start.mjs': {
    '': 1,
  },
  'plugin/hooks/subagent-stop.mjs': {
    '': 1,
  },
  'plugin/hooks/the-gate-kit.mjs': {
    'return false;': 2,
    'return path;': 1,
  },
  'plugin/hooks/where-the-record-is.mjs': {
    'return [path];': 1,
    'return undefined;': 1,
    'return true;': 1,
    'return [];': 1,
    'if (dirname(at) === at) return [path]; rest.unshift(at.slice(dirname(at).length + 1));': 1,
  },
};

function filesRead(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(join(REPO_ROOT, 'packages'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const src = join(REPO_ROOT, 'packages', entry.name, 'src');
    if (readdirSync(join(REPO_ROOT, 'packages', entry.name)).includes('src'))
      files.push(...sourceFiles(src));
  }
  for (const name of readdirSync(join(REPO_ROOT, 'plugin', 'hooks'))) {
    if (name.endsWith('.mjs')) files.push(join(REPO_ROOT, 'plugin', 'hooks', name));
  }
  return files.sort();
}

/** What the source holds now: per file, per body, the lines. */
function measured(): Map<string, Map<string, number[]>> {
  const now = new Map<string, Map<string, number[]>>();
  for (const file of filesRead()) {
    const path = relative(REPO_ROOT, file);
    if (path in EXEMPT) continue;
    for (const found of silentCatches(readFileSync(file, 'utf8'))) {
      const bodies = now.get(path) ?? new Map<string, number[]>();
      bodies.set(found.body, [...(bodies.get(found.body) ?? []), found.line]);
      now.set(path, bodies);
    }
  }
  return now;
}

describe('no new silent catch', () => {
  const now = measured();

  it('holds no silent catch the frozen list does not have', () => {
    const newOnes: string[] = [];
    for (const [path, bodies] of now) {
      for (const [body, lines] of bodies) {
        const frozen = FROZEN[path]?.[body] ?? 0;
        if (lines.length <= frozen) continue;
        for (const line of lines.slice(frozen)) {
          newOnes.push(`${path}:${line} catch { ${body} }`);
        }
      }
    }
    expect(
      newOnes,
      'a new silent catch drops its error: name it and use it, or rethrow; if the silence is the design, EXEMPT the file with the reason',
    ).toEqual([]);
  });

  it('keeps nothing frozen that the source no longer has', () => {
    const gone: string[] = [];
    for (const [path, bodies] of Object.entries(FROZEN)) {
      for (const [body, frozen] of Object.entries(bodies)) {
        const held = now.get(path)?.get(body)?.length ?? 0;
        if (held < frozen) gone.push(`${path} x${frozen - held} catch { ${body} }`);
      }
    }
    expect(
      gone,
      'these catches are not silent any more: drop them from FROZEN so the count only falls',
    ).toEqual([]);
  });

  it('exempts only files that exist, each with a reason', () => {
    for (const [path, reason] of Object.entries(EXEMPT)) {
      expect(filesRead().map((file) => relative(REPO_ROOT, file))).toContain(path);
      expect(reason.trim().length).toBeGreaterThan(0);
    }
  });
});
