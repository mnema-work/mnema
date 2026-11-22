// What a person on Windows or macOS does with mnema, run end to end on that system.
//
// It packs `@mnema/code`, installs that tarball alone with `npm i -g` into an empty
// prefix and an empty HOME (so the launcher is the one npm writes on that system: a symlink on
// macOS, `mnema.cmd` on Windows), and then drives the INSTALLED binary:
//
//   init, decision record, accept, a rule that refuses a write, verify, the record in a clone that
//   git checked out with the system's own line endings, the Python reader over that record, a
//   tail of it turned into a junction (a symbolic link elsewhere) and refused by both readers,
//   doctor, and the plugin's hook handlers on payloads whose paths are written the way that
//   system writes them.
//
// It is a script and not a test for the reason `the-packed-install/run.sh` is: only a package
// installed from what `pnpm pack` made, with nothing of the workspace beside it, finds what the
// workspace hides. It touches nothing outside the temporary directory it makes. Run it from the
// root of a built workspace: `node .github/the-other-systems/smoke.mjs`.
//
// WHAT IT DOES NOT PROVE: that a host starts the plugin's `hooks.json` commands (`node`, the handler
// from `${CLAUDE_PLUGIN_ROOT}` and its arguments): the handlers are run directly here, with the
// arguments the file gives them. The vitest suite does not run here; it runs on Linux.

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const WINDOWS = process.platform === 'win32';
const MAC = process.platform === 'darwin';
const root = resolve(process.cwd());
const work = mkdtempSync(join(tmpdir(), 'mnema-smoke-'));
// What the system calls the directory, which on Windows may be an 8.3 name (`RUNNER~1`) and on
// macOS goes through `/var` -> `/private/var`; and what it really is.
const named = work;
const real = realpathSync.native(work);

let failures = 0;
/** @param {string} message */
const fail = (message) => {
  failures += 1;
  console.log(`FAIL: ${message}`);
};
/**
 * @param {boolean} ok
 * @param {string} message
 */
const check = (ok, message) => {
  if (!ok) fail(message);
  else console.log(`ok: ${message}`);
};
/** @param {string} title */
const section = (title) => console.log(`\n== ${title}`);

const home = join(real, 'home');
const prefix = join(real, 'prefix');
const tarballs = join(real, 'tarballs');
for (const dir of [home, prefix, tarballs]) mkdirSync(dir);

// npm puts the launcher in `<prefix>` on Windows and in `<prefix>/bin` elsewhere.
const binDir = WINDOWS ? prefix : join(prefix, 'bin');
// Windows spells it `Path`, and a copy of the environment keeps that spelling.
const PATH_KEY = Object.keys(process.env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH';
/** @type {Record<string, string | undefined>} */
const baseEnv = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  APPDATA: join(home, 'AppData', 'Roaming'),
  LOCALAPPDATA: join(home, 'AppData', 'Local'),
  XDG_CONFIG_HOME: join(home, '.config'),
  npm_config_cache: join(real, 'npm-cache'),
  [PATH_KEY]: `${binDir}${delimiter}${process.env[PATH_KEY] ?? ''}`,
};
for (const key of Object.keys(baseEnv)) {
  if (key.startsWith('MNEMA_') || key === 'CLAUDE_PROJECT_DIR' || key === 'CURSOR_VERSION') {
    delete baseEnv[key];
  }
}

/**
 * Runs a program; `shell` for the `.cmd` shims Windows needs one for. A shell joins the arguments
 * with spaces and nothing else, so each is quoted for `cmd` (none of ours holds a quote).
 *
 * @param {string} program
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string, string | undefined>, input?: string, shell?: boolean, timeout?: number }} [options]
 */
function run(program, args, { cwd = root, env = baseEnv, input, shell = false, timeout = 300_000 } = {}) {
  const ran = spawnSync(program, shell ? args.map((arg) => `"${arg}"`) : args, {
    cwd,
    env,
    input,
    encoding: 'utf-8',
    shell,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout,
  });
  return {
    status: ran.status,
    out: ran.stdout ?? '',
    err: ran.stderr ?? '',
    error: ran.error,
  };
}

/**
 * @param {string[]} args
 * @param {string} cwd
 */
const pnpm = (args, cwd) => run('pnpm', args, { cwd, shell: WINDOWS });
/**
 * @param {string[]} args
 * @param {string} cwd
 * @param {{ env?: Record<string, string | undefined>, input?: string, timeout?: number }} [options]
 */
const mnema = (args, cwd, options = {}) =>
  run(WINDOWS ? 'mnema.cmd' : 'mnema', args, { cwd, shell: WINDOWS, ...options });

/**
 * @param {string} label
 * @param {ReturnType<typeof run>} ran
 * @param {{ tail?: number }} [options]
 */
function mustRun(label, ran, { tail = 4000 } = {}) {
  const all = `${ran.out}${ran.err}`.trim();
  const said = all.length > tail ? `...${all.slice(-tail)}` : all;
  console.log(`$ ${label}${said === '' ? '' : `\n${said.replace(/^/gm, '  ')}`}`);
  if (ran.status !== 0)
    fail(`${label} exited ${ran.status}${ran.error ? ` (${ran.error.message})` : ''}`);
  return ran;
}

try {
  console.log(`${process.platform} ${process.arch}, node ${process.version}`);
  console.log(`tmpdir as named: ${named}; as it really is: ${real}`);

  section('pack and install @mnema/code alone');
  // A person installs `@mnema/code` and nothing else: the command is one bundle, and the other
  // packages are carried inside it.
  mustRun(
    'pnpm pack code',
    pnpm(['pack', '--pack-destination', tarballs], join(root, 'packages', 'code')),
  );
  const files = readdirSync(tarballs).map((name) => join(tarballs, name));
  check(files.length === 1, `one tarball packed (${files.length})`);
  mustRun(
    'npm i -g',
    run('npm', ['i', '-g', '--prefix', prefix, '--no-audit', '--no-fund', ...files], {
      shell: WINDOWS,
    }),
  );
  // The first line of `--parseable` is the prefix itself. The bundle imports string-width (with
  // its three), so more than five is a dependency the command never loads.
  const listed = mustRun(
    'npm ls -g --all --parseable',
    run('npm', ['ls', '-g', '--all', '--parseable', '--prefix', prefix], { shell: WINDOWS }),
  );
  const installed = listed.out.split(/\r?\n/).filter((line) => line.trim() !== '').length - 1;
  check(installed <= 5, `npm installed ${installed} packages for @mnema/code, at most five`);
  const wantVersion = JSON.parse(
    readFileSync(join(root, 'packages', 'code', 'package.json'), 'utf-8'),
  ).version;
  const version = mustRun('mnema --version', mnema(['--version'], real));
  check(version.out.trim() === wantVersion, `the installed binary says ${wantVersion}`);

  section('init, record, accept, a rule, verify');
  const project = join(real, 'project');
  mkdirSync(join(project, 'src', 'billing'), { recursive: true });
  /**
   * @param {string[]} args
   * @param {string} [cwd]
   */
  const git = (args, cwd = project) => run('git', args, { cwd });
  mustRun('git init', git(['init', '-q']));
  git(['config', 'user.email', '120697114+felipesauer@users.noreply.github.com']);
  git(['config', 'user.name', 'smoke']);
  git(['config', 'core.autocrlf', WINDOWS ? 'true' : 'false']);
  mustRun('mnema init', mnema(['init'], project));
  const recorded = mustRun(
    'mnema decision record',
    mnema(
      ['decision', 'record', 'Keep money as integer cents', 'Float sums drift; cents are exact.'],
      project,
    ),
  );
  const id = recorded.out.match(/\(([0-9a-f-]{20,})\)/)?.[1];
  check(id !== undefined, 'the record echoes the decision id');
  if (id === undefined) throw new Error('no decision id; nothing after this can run');
  mustRun(
    'mnema decision move accept',
    mnema(['decision', 'move', 'accept', id, '--note', 'agreed'], project),
  );
  const ruleSource = mustRun(
    'mnema decision record (the rule)',
    mnema(['decision', 'record', 'Billing is frozen', 'No edits under src/billing.'], project),
  );
  const ruleId = ruleSource.out.match(/\(([0-9a-f-]{20,})\)/)?.[1];
  if (ruleId === undefined) throw new Error('no id for the rule');
  mustRun(
    'accept the rule',
    mnema(['decision', 'move', 'accept', ruleId, '--note', 'agreed'], project),
  );
  mustRun(
    'link the rule',
    mnema(['link', ruleId, 'src/billing', '--rel', 'refuses-a-write'], project),
  );
  const verified = mustRun(
    'mnema verify --require signed',
    mnema(['verify', '--require', 'signed'], project),
  );
  check(/local integrity verified/.test(verified.out), 'verify says the record is intact');

  section('a checkout with the system own line endings still verifies');
  mustRun('git add', git(['add', '-A']));
  mustRun('git commit', git(['commit', '-q', '-m', 'record']));
  const clone = join(real, 'clone');
  mustRun(
    'git clone (core.autocrlf=true)',
    run('git', ['-c', 'core.autocrlf=true', 'clone', '-q', project, clone], { cwd: real }),
  );
  const everyEntry = readdirSync(join(clone, '.mnema'), { recursive: true, encoding: 'utf-8' });
  const some = everyEntry
    .map((entry) => join(clone, '.mnema', entry))
    .filter((path) => path.endsWith('.jsonl') || path.endsWith('.json'));
  const crlf = some.filter((path) => readFileSync(path).includes(Buffer.from('\r\n')));
  console.log(`  ${crlf.length} of ${some.length} record files carry CRLF in the checkout`);
  // The record's `.gitattributes` (`* -text`) is what keeps git from converting its files: with
  // `core.autocrlf=true` in the clone, none may have come out with CRLF.
  check(
    some.length > 0 && crlf.length === 0,
    'the clone, with core.autocrlf=true, holds every record file with LF',
  );
  // A path of the record is `.mnema/...` below the project, and Windows stops at 260 characters
  // for the whole path unless the machine opted in to long paths: say how much room is left.
  const longest = everyEntry.reduce((most, entry) => Math.max(most, entry.length), 0);
  console.log(`  the longest path below .mnema/ here is ${longest} characters`);
  const inClone = mustRun(
    'mnema verify in the clone',
    mnema(['verify', '--require', 'signed'], clone),
  );
  check(
    /local integrity verified/.test(inClone.out),
    'the clone verifies (it holds LF; that a reader accepts CRLF is not shown)',
  );

  section('the second reader (Python)');
  const candidates = WINDOWS ? ['python', 'py', 'python3'] : ['python3', 'python'];
  const python = candidates.find((name) => run(name, ['--version']).status === 0);
  check(python !== undefined, `a Python is on the PATH (${python})`);
  const reader = join(root, 'packages', 'chain', 'verifier', 'mnema_verify.py');
  if (python !== undefined) {
    mustRun('python self-test', run(python, ['-I', reader, 'self-test']), { tail: 300 });
    const readRecord = mustRun(
      'python reads the clone record',
      run(python, ['-I', reader, 'record', join(clone, '.mnema'), '--require', 'signed']),
      { tail: 300 },
    );
    check(readRecord.status === 0, 'the Python reader accepts the checked-out record');
  }

  // A junction is what a person on Windows makes without being an administrator, and Node reads it
  // as a link; Python's `os.path.islink` does not, so the second reader asks the listing's reparse
  // tag, the three libuv's `lstat` calls a link. On the other systems the type is ignored and this is a symbolic link. The clone is not used after this.
  section('a tail that is a junction, or a symbolic link, is refused by both readers');
  const tailsInClone = join(clone, '.mnema', 'tails');
  const [linkedTail] = readdirSync(tailsInClone);
  if (linkedTail === undefined) throw new Error('the clone holds no tail');
  const movedOut = join(real, 'a-tail-moved-out');
  renameSync(join(tailsInClone, linkedTail), movedOut);
  symlinkSync(movedOut, join(tailsInClone, linkedTail), 'junction');
  const refusedHere = mnema(['verify', '--require', 'signed'], clone);
  check(
    refusedHere.status === 1 &&
      `${refusedHere.out}${refusedHere.err}`.includes(`LINKED TAIL: tails/${linkedTail}`),
    `mnema verify refuses the linked tail by name (exit ${refusedHere.status})`,
  );
  if (python !== undefined) {
    const refusedThere = run(python, ['-I', reader, 'record', join(clone, '.mnema')]);
    check(
      refusedThere.status === 1 &&
        refusedThere.out.includes(`tails/${linkedTail} is a symbolic link`),
      `the Python reader refuses the linked tail by name (exit ${refusedThere.status})`,
    );
  }

  // Where a tail's notes and lock live inside a repository: under the common git directory, shared by
  // every worktree and out of reach of a clean of what git ignores. A linked worktree names its git
  // directory with a path relative to its own (`commondir`), on Windows with a folder of its own whose
  // name holds a space and a letter that is not ASCII.
  section('a worktree shares the notes of its repository, and a clean does not take them');
  const worktree = join(real, 'a w\u00e7');
  mustRun('git worktree add', git(['worktree', 'add', '-q', '-b', 'a-worktree', worktree]));
  mustRun('mnema memory in the worktree', mnema(['memory', 'from the worktree'], worktree));
  const sharedLocks = join(project, '.git', 'mnema', '%2E', 'public', 'locks');
  const notes = readdirSync(sharedLocks).filter((name) => name.endsWith('.head'));
  check(
    notes.length >= 2,
    `the notes of the tails are under the common git directory (${notes.length})`,
  );
  check(
    !readdirSync(join(worktree, '.mnema', 'keys')).some((name) => name.endsWith('.inst')),
    'the worktree keeps no installation id inside the record',
  );
  const tailsBefore = readdirSync(join(project, '.mnema', 'tails')).length;
  mustRun('git clean -fdX', git(['clean', '-fdXq']));
  mustRun('mnema memory after the clean', mnema(['memory', 'after the clean'], project));
  const tailsAfter = readdirSync(join(project, '.mnema', 'tails')).length;
  check(
    tailsAfter === tailsBefore,
    `a clean of what git ignores opens no tail (${tailsBefore} before, ${tailsAfter} after)`,
  );
  const inWorktree = mustRun('mnema verify in the worktree', mnema(['verify'], worktree));
  check(/local integrity verified/.test(inWorktree.out), 'the worktree verifies');

  section('a backup of the project into a folder');
  mustRun(
    'mnema decision record (private)',
    mnema(
      ['decision', 'record', 'Kept on this machine', 'Not for the team.', '--scope', 'private'],
      project,
    ),
  );
  const folder = join(real, 'backup-folder');
  const refused = mnema(['backup', 'setup', folder], project);
  check(
    refused.status !== 0 && !existsSync(join(home, '.mnema', 'backup.json')),
    'backup setup is refused where no person is at a terminal, and assigns nothing',
  );
  // The folder is assigned by writing the machine's file, which `setup` writes after a person confirms it.
  const verdict = JSON.parse(
    mustRun('mnema verify --json', mnema(['verify', '--json'], project)).out,
  );
  const record = verdict.trees.find(
    (/** @type {{ scope: string }} */ one) => one.scope === 'public',
  )?.result?.record?.name;
  check(typeof record === 'string', 'verify names the record');
  mkdirSync(join(home, '.mnema'), { recursive: true });
  writeFileSync(
    join(home, '.mnema', 'backup.json'),
    JSON.stringify({
      format: 1,
      projects: { [record]: { destination: folder, setUpAt: new Date().toISOString() } },
    }),
  );
  const backedUp = mustRun('mnema backup run', mnema(['backup', 'run'], project));
  check(
    /private tree: \d+ file\(s\) held/.test(backedUp.out),
    'backup run copies the private tree',
  );
  const copies = readdirSync(folder, { recursive: true }).map(String);
  check(
    copies.some((name) => name.endsWith('.jsonl')) && !copies.some((name) => name.endsWith('.key')),
    'the folder holds the tails and no key',
  );
  const standing = mustRun('mnema backup status', mnema(['backup', 'status'], project));
  check(/nothing to add/.test(standing.out), 'backup status says the copy is up to date');

  // The private tree is lost and put back from the copy, and the copy verifies.
  const privateTree = join(project, '.git', 'mnema', '%2E', 'private');
  const tailsInTheTree = readdirSync(join(privateTree, 'tails')).length;
  rmSync(privateTree, { recursive: true, force: true });
  const dry = mustRun(
    'mnema backup restore --dry-run',
    mnema(['backup', 'restore', '--dry-run'], project),
  );
  check(
    /nothing was written/.test(dry.out) && !existsSync(privateTree),
    'backup restore --dry-run writes nothing',
  );
  mustRun('mnema backup restore', mnema(['backup', 'restore'], project));
  check(
    readdirSync(join(privateTree, 'tails')).length === tailsInTheTree,
    'backup restore puts the private tails back',
  );
  const verifiedCopy = mustRun('mnema backup verify', mnema(['backup', 'verify'], project));
  check(
    /the copy is a record this mnema accepts/.test(verifiedCopy.out),
    'backup verify reads the copy and finds the tree as it is',
  );

  // A restore of another record asks a person, and a smoke has no terminal: without one it refuses,
  // says the command, and writes nothing. What the person's yes leaves (the live tree moved into
  // the git directory, under a name with no colon) is planted by hand, and `--undo` puts it back.
  const askedFirst = mnema(['backup', 'restore', '--from', 'cd'.repeat(32)], project);
  check(askedFirst.status !== 0, 'backup restore of a record with no copy is refused');
  const aside = join(project, '.git', 'mnema', 'before-restore-2026-11-12T23-36-30Z');
  mkdirSync(aside, { recursive: true });
  writeFileSync(
    join(aside, 'before-restore.json'),
    JSON.stringify({ trees: { private: privateTree } }),
  );
  renameSync(privateTree, join(aside, 'private'));
  const undone = mustRun(
    'mnema backup restore --undo',
    mnema(['backup', 'restore', '--undo'], project),
  );
  check(
    /Put back the private tree/.test(undone.out) &&
      readdirSync(join(privateTree, 'tails')).length === tailsInTheTree,
    'backup restore --undo puts the tree kept aside back',
  );
  const undoneTwice = mnema(['backup', 'restore', '--undo'], project);
  check(
    undoneTwice.status !== 0 && /nothing to put back/.test(undoneTwice.err + undoneTwice.out),
    'a second --undo has nothing to put back',
  );

  section('doctor');
  const doctor = mustRun('mnema doctor', mnema(['doctor'], project));
  check(doctor.out.trim() !== '', 'doctor says something');

  section('the MCP server answers over stdio');
  // A host starts `mnema mcp` through the launcher npm wrote (a `.cmd` shim on Windows, a link on
  // macOS) and talks to it over a pipe, one JSON message per line. The server ends its session by
  // itself when its input ends, so the call returns; a minute is all it is given, so one that does
  // not end fails the job in a minute and not in five.
  const talk = [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'the-other-systems-smoke', version: '0' },
      },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ];
  const served = mnema(['mcp'], project, {
    input: `${talk.map((message) => JSON.stringify(message)).join('\n')}\n`,
    timeout: 60_000,
  });
  console.log(`$ mnema mcp (stdin: initialize, initialized, tools/list)\n${served.err}`.slice(0, 1200));
  /** @type {Array<{ id?: number, result?: { serverInfo?: unknown, tools?: Array<{ name?: string }> } }>} */
  const answers = [];
  for (const line of served.out.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try {
      answers.push(JSON.parse(line));
    } catch {
      console.log(`  not a JSON message: ${line.slice(0, 200)}`);
    }
  }
  const initialized = answers.find((answer) => answer.id === 1);
  const listed = answers.find((answer) => answer.id === 2);
  const names = (listed?.result?.tools ?? []).map((tool) => tool.name);
  check(served.status === 0, `mnema mcp exits 0 when its input ends (exited ${served.status})`);
  check(
    initialized?.result?.serverInfo !== undefined,
    'the answer to initialize names the server',
  );
  check(
    names.length > 0 && names.includes('bootstrap') && names.includes('capture_memory'),
    `tools/list answers with tools that include bootstrap and capture_memory (${names.length} listed)`,
  );
  check(
    !/\n\s+at .+[:(]\d+/.test(served.err),
    'the standard error of mnema mcp holds no stack trace',
  );

  section('the plugin hook handlers on payloads written the way this system writes paths');
  const hooks = join(root, 'plugin', 'hooks');
  const hookEnv = {
    ...baseEnv,
    CLAUDE_PROJECT_DIR: project,
    CLAUDE_PLUGIN_ROOT: join(root, 'plugin'),
  };
  /**
   * @param {string} file
   * @param {string[]} args
   * @param {Record<string, string | undefined>} env
   * @param {string} input
   */
  const handler = (file, args, env, input) =>
    run(process.execPath, [join(hooks, file), ...args], { cwd: project, env, input });

  const opened = handler('session-start.mjs', [], hookEnv, '');
  console.log(`$ session-start.mjs\n${opened.out}${opened.err}`.slice(0, 1200));
  check(opened.status === 0, 'session-start exits 0');
  check(
    opened.out.includes('Keep money as integer cents'),
    'session-start hands over the decision in force',
  );

  const cursorEnv = { ...hookEnv, CURSOR_VERSION: '2026.09.18' };
  /** @param {string} file */
  const payload = (file) =>
    JSON.stringify({
      hook_event_name: 'preToolUse',
      cursor_version: '2026.09.18',
      tool_name: 'Write',
      tool_input: { file_path: file, content: 'x\n' },
      workspace_roots: [project],
    });
  const refuseArgs = ['--host', 'cursor', '--where', 'CURSOR_VERSION', '--agent-key', 'cursor'];
  /**
   * @param {string} label
   * @param {string} file
   */
  const denied = (label, file) => {
    let ran = handler('edit-refuses-a-write.mjs', refuseArgs, cursorEnv, payload(file));
    // A slow runner can take the gate past its 10 s: it closes without naming a rule, as it must.
    // That one refusal, and only that one, is asked again (twice at most); any other refusal that
    // does not name the rule fails at the first answer.
    for (let again = 1; again <= 2 && /did not answer in 10 seconds/.test(ran.out); again++) {
      console.log(`(the gate did not answer in 10 seconds, asking again: ${again} of 2) ${label}`);
      ran = handler('edit-refuses-a-write.mjs', refuseArgs, cursorEnv, payload(file));
    }
    console.log(
      `$ edit-refuses-a-write.mjs (${label}) ${file}\n${ran.out}${ran.err}`.slice(0, 900),
    );
    // The refusal must be THE RULE'S: a gate that could not start `mnema` also denies a write a
    // rule reaches, with a reason that names no rule, and a check for "deny" alone would pass on it.
    let reason = '';
    try {
      reason = JSON.parse(ran.out).hookSpecificOutput?.permissionDecisionReason ?? '';
    } catch {}
    check(
      ran.status === 0 &&
        /"permissionDecision":"deny"/.test(ran.out) &&
        reason.includes(ruleId) &&
        !/could not answer/.test(reason),
      `a write is refused by the rule, which the refusal names: ${label}`,
    );
  };
  /**
   * @param {string} label
   * @param {string} file
   */
  const allowed = (label, file) => {
    const ran = handler('edit-refuses-a-write.mjs', refuseArgs, cursorEnv, payload(file));
    check(ran.status === 0 && !/deny/.test(ran.out), `a write elsewhere is not refused: ${label}`);
  };
  // The path as the system writes it: backslashes and a drive letter on Windows.
  denied('the project path as the system names it', join(project, 'src', 'billing', 'invoice.ts'));
  allowed('outside the rule', join(project, 'src', 'other', 'a.ts'));
  if (named !== real) {
    // The runner's temp directory has a second spelling (an 8.3 name, or a link): a host may
    // report either, and a refusal that holds for one spelling only is no refusal.
    denied(
      'the project path in the other spelling of the temp directory',
      join(named, 'project', 'src', 'billing', 'invoice.ts'),
    );
  }
  if (WINDOWS) {
    denied('forward slashes', join(project, 'src', 'billing', 'invoice.ts').replaceAll('\\', '/'));
    denied(
      'the drive letter in lower case',
      join(project, 'src', 'billing', 'invoice.ts').replace(/^[A-Z]:/, (d) => d.toLowerCase()),
    );
  }
  // The volumes are case-insensitive, so a host that reports `SRC/Billing` for the folder the rule
  // addresses as `src/billing` names the same file, and the rule holds because the folder is there
  // to be resolved to the case the disk keeps. (A folder that is not on disk yet cannot be.)
  if (WINDOWS || MAC) {
    denied(
      'other letter case for a folder that exists',
      join(project, 'SRC', 'Billing', 'invoice.ts'),
    );
  }
} catch (fault) {
  fail(`the smoke itself stopped: ${fault instanceof Error ? fault.stack : String(fault)}`);
} finally {
  rmSync(work, { recursive: true, force: true, maxRetries: 5 });
}

console.log(failures === 0 ? '\nall ok' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
