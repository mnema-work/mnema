/**
 * `mnema doctor`: what a machine says about how mnema is installed (the binary on the PATH,
 * the plugin and its version, the MCP server declared twice, a namesake) one line to a finding,
 * and not one byte written. Each case builds the machine in a sandbox and reads the answer.
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type DoctorContext, runDoctor } from '../src/commands/doctor.js';
import { pluginTreeHash } from '../src/plugin-tree-hash.js';
import { MNEMA_CLI } from './support/the-cli.js';

const CLI = MNEMA_CLI;

let sandbox: string;
let home: string;
let project: string;

function executable(path: string, body = '#!/bin/sh\n'): string {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body);
  chmodSync(path, 0o755);
  return path;
}

function context(over: Partial<DoctorContext> & { path?: string } = {}): DoctorContext {
  return {
    cwd: project,
    env: { home },
    processEnv: { PATH: over.path ?? '' },
    running: { file: join(sandbox, 'running', 'mnema'), version: '9.9.9' },
    ...over,
  };
}

function said(over: Partial<DoctorContext> & { path?: string } = {}): string[] {
  return runDoctor(context(over)).findings.map((one) => `${one.state} ${one.topic} ${one.line}`);
}

function installPlugin(id: string, version: string): void {
  const file = join(home, '.claude', 'plugins', 'installed_plugins.json');
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({ version: 2, plugins: { [id]: [{ scope: 'user', version }] } }),
  );
}

/** Every file under `dir` with its bytes, so "writes nothing" is a comparison. */
function digest(dir: string): string {
  const lines: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    lines.push(
      `${path} ${entry.isFile() ? readFileSync(path, 'utf-8') : ''} ${statSync(path).mtimeMs}`,
    );
  }
  return lines.sort().join('\n');
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-doctor-'));
  home = join(sandbox, 'home');
  project = join(sandbox, 'project');
  mkdirSync(home, { recursive: true });
  mkdirSync(project, { recursive: true });
  executable(join(sandbox, 'running', 'mnema'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('the binary on the PATH', () => {
  it('says there is none, and what to install', () => {
    const lines = said({ path: join(sandbox, 'empty') });
    expect(lines[0]).toContain('attention binary no “mnema” on the PATH');
    expect(lines[0]).toContain('npm i -g @mnema/code');
  });

  it('knows the first one on the PATH is the one running, and when it is not', () => {
    const mine = join(sandbox, 'running');
    expect(said({ path: mine })[0]).toContain('and it is the one running now (9.9.9)');
    const other = executable(join(sandbox, 'other', 'mnema'));
    const lines = said({ path: [join(sandbox, 'other'), mine].join(delimiter) });
    expect(lines[0]).toContain(`the first “mnema” on the PATH is ${other}`);
    expect(lines[0]).toContain('put the one you mean first on the PATH');
  });
});

describe('a namesake', () => {
  it('names a second executable on the PATH, and an npm package called mnema', () => {
    executable(join(sandbox, 'other', 'mnema'), '#!/bin/sh\necho other\n');
    const path = [join(sandbox, 'running'), join(sandbox, 'other')].join(delimiter);
    mkdirSync(join(sandbox, 'lib', 'node_modules', 'mnema'), { recursive: true });
    writeFileSync(
      join(sandbox, 'lib', 'node_modules', 'mnema', 'package.json'),
      JSON.stringify({ name: 'mnema', version: '3.2.1' }),
    );
    mkdirSync(join(sandbox, 'bin'), { recursive: true });
    const lines = said({ path: [path, join(sandbox, 'bin')].join(delimiter) });
    const namesakes = lines.filter((line) => line.startsWith('attention namesake'));
    expect(namesakes.some((line) => line.includes('2 different “mnema” executables'))).toBe(true);
    expect(
      namesakes.some((line) => line.includes('an npm package named “mnema” 3.2.1 is installed')),
    ).toBe(true);
  });

  it('says when there is none, and that the registry was not asked', () => {
    const lines = said({ path: join(sandbox, 'running') });
    expect(lines.find((line) => line.includes('namesake'))).toContain('the registry was not asked');
    expect(lines.filter((line) => line.startsWith('attention namesake'))).toEqual([]);
  });
});

/** A plugin folder with these files, and the list that says a host put it at `dir`. */
function installedAt(dir: string, files: Record<string, string>, version = '9.9.9'): void {
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  const file = join(home, '.claude', 'plugins', 'installed_plugins.json');
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({
      version: 2,
      plugins: { 'mnema@mnema': [{ scope: 'user', version, installPath: dir }] },
    }),
  );
}

describe('the content of the plugin', () => {
  const released = { 'hooks/a.mjs': 'one\ntwo\n', 'README.md': 'text\n' };
  let digest: string;
  beforeEach(() => {
    const folder = join(sandbox, 'released');
    for (const [name, body] of Object.entries(released)) {
      mkdirSync(join(folder, name, '..'), { recursive: true });
      writeFileSync(join(folder, name), body);
    }
    digest = pluginTreeHash(folder) as string;
  });
  const line = (): string =>
    said({ pluginTrees: { mnema: digest } }).find((one) =>
      one.includes('released with this binary'),
    ) ?? '';

  it('says the files are the ones released when they are', () => {
    installedAt(join(sandbox, 'cache', 'mnema', '9.9.9'), released);
    expect(line()).toMatch(
      /^fine plugin the files of plugin mnema@mnema at .* are the ones released with this binary \(9\.9\.9\)/,
    );
  });

  it('says the same label over other content, with the host commands, and that the label alone moves it', () => {
    installedAt(join(sandbox, 'cache', 'mnema', '9.9.9'), {
      ...released,
      'hooks/a.mjs': 'one\nchanged\n',
    });
    const said = said_other();
    expect(said).toContain('attention plugin plugin mnema@mnema has the label 9.9.9');
    expect(said).toContain('but other content than the one released');
    expect(said).toContain(
      '`claude plugin marketplace update mnema`, then `claude plugin update mnema@mnema`',
    );
    expect(said).toContain('only when the label changes');
    expect(said).toContain('`claude plugin uninstall mnema@mnema`');
  });

  it('does not take the marks the host leaves in the folder for other content', () => {
    const dir = join(sandbox, 'cache', 'mnema', '9.9.9');
    installedAt(dir, {
      ...released,
      '.in_use/4242': '{"pid":4242,"procStart":"1"}',
      '.orphaned_at': '1',
    });
    expect(line()).toContain('are the ones released with this binary');
    installedAt(dir, { 'hooks/.in_use': 'x' });
    expect(said_other()).toContain('but other content');
  });

  it('does not take a copy whose lines end with CR LF for other content', () => {
    installedAt(join(sandbox, 'cache', 'mnema', '9.9.9'), {
      'hooks/a.mjs': 'one\r\ntwo\r\n',
      'README.md': 'text\r\n',
    });
    expect(line()).toContain('are the ones released with this binary');
  });

  it('says nothing about content when the label differs, and when this binary knows no digest', () => {
    installedAt(join(sandbox, 'cache', 'mnema', '0.0.1'), released, '0.0.1');
    expect(line()).toBe('');
    installedAt(join(sandbox, 'cache', 'mnema', '9.9.9'), released);
    expect(said({ pluginTrees: {} }).some((one) => one.includes('released with this binary'))).toBe(
      false,
    );
  });

  it('says the files could not be read when the path is not there', () => {
    installedAt(join(sandbox, 'cache', 'mnema', '9.9.9'), released);
    rmSync(join(sandbox, 'cache'), { recursive: true });
    expect(line()).toContain(
      'could not be read, so whether they are the ones released with this binary is unknown',
    );
  });

  function said_other(): string {
    return (
      said({ pluginTrees: { mnema: digest } }).find((one) =>
        one.startsWith('attention plugin plugin mnema@mnema has the label'),
      ) ?? ''
    );
  }
});

describe('the plugin', () => {
  it('names its version, and asks for an update when it differs from the binary', () => {
    installPlugin('mnema@mnema', '9.9.9');
    expect(said().find((line) => line.includes('plugin mnema@mnema'))).toContain(
      'fine plugin plugin mnema@mnema is installed at 9.9.9',
    );
    installPlugin('mnema@mnema', '0.0.1');
    expect(said().find((line) => line.includes('plugin mnema@mnema'))).toContain(
      'attention plugin plugin mnema@mnema is installed at 0.0.1 (user scope) and this binary is 9.9.9, newer than the plugin',
    );
  });

  it('says a binary older than the plugin is the pair that breaks, with the command that fixes it', () => {
    installPlugin('mnema@mnema', '10.0.0');
    const line = said().find((one) => one.includes('plugin mnema@mnema')) as string;
    expect(line).toContain('attention plugin plugin mnema@mnema is installed at 10.0.0');
    expect(line).toContain('this binary is 9.9.9, older than the plugin');
    expect(line).toContain('`npm i -g @mnema/code@10.0.0`');
  });

  it('does not claim an order between versions it cannot read', () => {
    installPlugin('mnema@mnema', 'unknown');
    const line = said().find((one) => one.includes('plugin mnema@mnema')) as string;
    expect(line).toContain('could not be ordered');
    expect(line).not.toContain('npm i -g');
  });

  it('says what to install when the list holds none, and that it is unknown when it cannot be read', () => {
    installPlugin('another@marketplace', '1.0.0');
    expect(said().find((line) => line.startsWith('fine plugin'))).toContain(
      'claude plugin install mnema-server-only@mnema',
    );
    rmSync(join(home, '.claude'), { recursive: true });
    expect(said().find((line) => line.startsWith('fine plugin'))).toContain(
      'whether the plugin is installed is unknown',
    );
  });
});

describe('the MCP server declared twice', () => {
  it('counts the plugin and a configured server as two, and one alone as one', () => {
    writeFileSync(
      join(project, '.mcp.json'),
      JSON.stringify({ mcpServers: { mnema: { command: 'mnema', args: ['mcp'] } } }),
    );
    expect(said().find((line) => line.includes(' mcp '))).toContain('declared once');
    installPlugin('mnema@mnema', '9.9.9');
    const twice = said().find((line) => line.includes(' mcp '));
    expect(twice).toContain('attention mcp the mnema MCP server is declared 2 times');
    expect(twice).toContain('the plugin mnema@mnema');
    expect(twice).toContain('keep one and remove the others');
  });

  it('finds a server under another name when it starts `mnema mcp`', () => {
    mkdirSync(join(project, '.vscode'), { recursive: true });
    writeFileSync(
      join(project, '.vscode', 'mcp.json'),
      JSON.stringify({ servers: { memory: { command: '/usr/local/bin/mnema', args: ['mcp'] } } }),
    );
    expect(said().find((line) => line.includes(' mcp '))).toContain('“memory” in');
  });

  it('says what it looked at when there is none', () => {
    expect(said().find((line) => line.includes(' mcp '))).toContain(
      `no mnema MCP server declared in ${join(project, '.mcp.json')}`,
    );
  });
});

describe('mnema doctor, as a person runs it', () => {
  it('prints one line to a finding, exits 0, and writes nothing', () => {
    installPlugin('mnema@mnema', '0.0.1');
    const before = digest(sandbox);
    const ran = spawnSync(process.execPath, [CLI, 'doctor'], {
      cwd: project,
      encoding: 'utf-8',
      env: { HOME: home, PATH: join(sandbox, 'running') },
    });
    expect(ran.status).toBe(0);
    const lines = ran.stdout.trimEnd().split('\n');
    expect(lines.map((line) => line.split(':')[0])).toEqual([
      'to do · binary',
      'to do · node',
      'to do · plugin',
      'ok · vscode',
      'ok · mcp',
      'ok · namesake',
    ]);
    expect(lines[1]).toContain('no “node” on the PATH');
    expect(digest(sandbox)).toBe(before);
  });
});
