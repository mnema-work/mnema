// @reads-the-tree
/**
 * THE REFERENCE PAGES ARE GENERATED, AND ONE THAT DRIFTS FROM THE BINARY OR FROM THE SERVED
 * SCHEMA IS RED.
 *
 * `docs/reference/cli/` holds one page per verb of the command line, made from the verb's block
 * of `src/cli.help.golden.txt` (which `cli.golden.test.ts` holds to the program), and
 * `docs/reference/mcp/` one page per tool, made from what the MCP server serves in `tools/list`.
 * `docs/reference/commands.md` and `docs/reference/mcp-tools.md` index them. Each page is
 * compared with what `support/the-reference-pages.ts` makes of its source, its part written by
 * hand carried over; and each folder holds exactly the pages its source has, no more and no fewer.
 *
 * To change one of them, change the help or the tool and run this file with `-u`. A page whose
 * verb or tool is gone has to be deleted by hand: the case that counts the folder names it.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildMcpServer } from '../src/mcp/server.js';
import {
  commandsIndex,
  HAND_BEGIN,
  HAND_END,
  helpBlocks,
  helpGroups,
  type ServedTool,
  toolFile,
  toolPage,
  toolsIndex,
  verbFile,
  verbPage,
  writtenByHand,
} from './support/the-reference-pages.js';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const CLI = join(ROOT, 'docs', 'reference', 'cli');
const MCP = join(ROOT, 'docs', 'reference', 'mcp');
const COMMANDS = join(ROOT, 'docs', 'reference', 'commands.md');
const TOOLS = join(ROOT, 'docs', 'reference', 'mcp-tools.md');

const transcript = readFileSync(
  join(import.meta.dirname, '..', 'src', 'cli.help.golden.txt'),
  'utf8',
);
const blocks = helpBlocks(transcript);
const groups = helpGroups(transcript);

/** The committed page, or nothing where there is none yet. */
const committed = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

/** The pages a folder holds now. */
const pagesIn = (folder: string): string[] =>
  existsSync(folder)
    ? readdirSync(folder)
        .filter((file) => file.endsWith('.md'))
        .sort()
    : [];

/** The pages an index links in its folder. */
const linkedBy = (index: string, folder: string): string[] =>
  [...index.matchAll(new RegExp(`\\]\\(${folder}/([^)#]+)\\)`, 'g'))]
    .map((match) => match[1] as string)
    .sort();

let sandbox: string;
let tools: readonly ServedTool[];

beforeAll(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-reference-'));
  const { server } = buildMcpServer({
    cwd: sandbox,
    env: { home: join(sandbox, 'home') },
    log: () => {},
  });
  const client = new Client({ name: 'reference', version: '1.0.0' }, { capabilities: {} });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientSide), server.connect(serverSide)]);
  tools = (await client.listTools()).tools as ServedTool[];
  await client.close();
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('the page of each verb', () => {
  it('reads every verb the help lists in its groups, and the help of each', () => {
    const tops = blocks.filter((one) => one.words.length === 1).map((one) => one.words[0]);
    expect([...groups.keys()]).toEqual(tops);
    expect(groups.get('decision')).toBe('Record');
    expect(groups.get('mcp')).toBe('Called by a host');
    expect(blocks.some((one) => one.words.join(' ') === 'decision record')).toBe(true);
  });

  it.each(blocks.map((one) => [one.words.join(' '), one] as const))(
    'mnema %s is what its help generates',
    async (_, block) => {
      const path = join(CLI, verbFile(block.words));
      await expect(verbPage(block, blocks, groups, committed(path))).toMatchFileSnapshot(
        path,
        `${relative(ROOT, path)} is generated from the help: run pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u, and commit the page`,
      );
    },
  );

  it('has a page for each verb and none for a verb that is gone', () => {
    expect(pagesIn(CLI)).toEqual(blocks.map((one) => verbFile(one.words)).sort());
  });

  it('accuses a flag taken off a page by hand, and keeps the part written by hand', () => {
    const path = join(CLI, 'decision-record.md');
    const page = readFileSync(path, 'utf8');
    const block = blocks.find((one) => one.words.join(' ') === 'decision record');
    if (block === undefined) throw new Error('no help for mnema decision record');
    const dropped = page
      .split('\n')
      .filter((line) => !line.startsWith('| `--alternatives <text>`'))
      .join('\n');
    expect(dropped).not.toBe(page);
    expect(verbPage(block, blocks, groups, dropped)).toBe(page);
    const written = page.replace(HAND_END, `Written by a person.\n${HAND_END}`);
    expect(written).not.toBe(page);
    expect(verbPage(block, blocks, groups, written)).toBe(written);
  });

  it('is listed by the index, once, in the group of its verb', async () => {
    const index = commandsIndex(blocks, groups, committed(COMMANDS));
    await expect(index).toMatchFileSnapshot(
      COMMANDS,
      `${relative(ROOT, COMMANDS)} is generated from the help: run pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u, and commit the page`,
    );
    expect(linkedBy(index, 'cli')).toEqual(pagesIn(CLI));
    const called = index.split('## Called by a host')[1] ?? '';
    expect(called).toContain('](cli/before-a-write.md)');
    expect(called).toContain('](cli/run-start.md)');
  });
});

describe('the page of each MCP tool', () => {
  it('reads the tools the server serves', () => {
    const names = tools.map((tool) => tool.name);
    expect(names).toContain('record_decision');
    expect(names).toContain('bootstrap');
    expect(new Set(names).size).toBe(names.length);
  });

  it('is what the served tool generates', async () => {
    for (const tool of tools) {
      const path = join(MCP, toolFile(tool.name));
      await expect(toolPage(tool, committed(path))).toMatchFileSnapshot(
        path,
        `${relative(ROOT, path)} is generated from the tool: run pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u, and commit the page`,
      );
    }
  });

  it('has a page for each tool and none for a tool that is gone', () => {
    expect(pagesIn(MCP)).toEqual(tools.map((tool) => toolFile(tool.name)).sort());
  });

  it('accuses a description changed in the server and not on the page', () => {
    const tool = tools.find((one) => one.name === 'record_decision') as ServedTool;
    const page = readFileSync(join(MCP, toolFile(tool.name)), 'utf8');
    const moved = { ...tool, description: `${tool.description} One more sentence.` };
    expect(toolPage(moved, page)).not.toBe(page);
    expect(toolPage(tool, page)).toBe(page);
  });

  it('is listed by the index, once, in the family its annotations put it in', async () => {
    const index = toolsIndex(tools, committed(TOOLS));
    await expect(index).toMatchFileSnapshot(
      TOOLS,
      `${relative(ROOT, TOOLS)} is generated from the tools: run pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u, and commit the page`,
    );
    expect(linkedBy(index, 'mcp')).toEqual(pagesIn(MCP));
    const [reads, writes] = (index.split('## Read only')[1] ?? '').split('## May write');
    expect(reads).toContain('](mcp/bootstrap.md)');
    expect(writes).toContain('](mcp/record-decision.md)');
  });
});

describe('the part written by hand', () => {
  it('opens and closes on every page', () => {
    const pages = [
      ...pagesIn(CLI).map((file) => join(CLI, file)),
      ...pagesIn(MCP).map((file) => join(MCP, file)),
      COMMANDS,
      TOOLS,
    ];
    expect(pages.length).toBeGreaterThan(2);
    for (const path of pages) {
      const page = readFileSync(path, 'utf8');
      expect(page.split(HAND_BEGIN).length, path).toBe(2);
      expect(page.indexOf(HAND_END), path).toBeGreaterThan(page.indexOf(HAND_BEGIN));
    }
  });

  it('is all the guards that read what a page hands over read of a reference page', () => {
    const path = 'docs/reference/cli/site.md';
    const page = readFileSync(join(ROOT, path), 'utf8');
    const written = page.replace(HAND_END, `Run \`mnema verify\` first.\n${HAND_END}`);
    const read = writtenByHand(path, written).split('\n');
    expect(read).toHaveLength(written.split('\n').length);
    expect(read.filter((line) => line !== '')).toEqual(['Run `mnema verify` first.']);
    expect(writtenByHand('docs/install.md', written)).toBe(written);
  });
});
