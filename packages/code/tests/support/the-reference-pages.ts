/**
 * The reference pages: one per verb of the command line under `docs/reference/cli/`, one per tool
 * of the MCP server under `docs/reference/mcp/`, and an index for each folder
 * (`docs/reference/commands.md`, `docs/reference/mcp-tools.md`).
 * `the-reference-pages-are-generated.test.ts` compares each page with what this makes.
 *
 * A verb's page is made from its block of `src/cli.help.golden.txt`, the help the program prints,
 * which `cli.golden.test.ts` holds to the program itself. A tool's page is made from what the
 * server serves in `tools/list`: name, title, description, input schema and annotations.
 *
 * A page keeps one part written by hand: what sits between {@link HAND_BEGIN} and {@link HAND_END}
 * is carried over from the committed page byte for byte, and everything else is regenerated.
 */

/** The marker that opens the part of a page written by hand. */
export const HAND_BEGIN =
  '<!-- Written by hand: the generator keeps what is between this line and the next marker. -->';
/** The marker that closes it. */
export const HAND_END = '<!-- End of the part written by hand. -->';

/** One block of the help transcript: the verb's words after `mnema`, and the lines it printed. */
export interface HelpBlock {
  readonly words: readonly string[];
  readonly lines: readonly string[];
}

/** A tool as `tools/list` serves it, with the fields a page shows. */
export interface ServedTool {
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
  readonly inputSchema: {
    readonly properties?: Readonly<Record<string, SchemaProperty>>;
    readonly required?: readonly string[];
  };
  readonly annotations?: Readonly<Record<string, unknown>>;
}

interface SchemaProperty {
  readonly type?: string;
  readonly enum?: readonly unknown[];
  readonly description?: string;
  readonly minLength?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
}

const HELP_SOURCE = 'packages/code/src/cli.help.golden.txt';
const UPDATE = 'pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u';
const HELP_UPDATE = 'pnpm vitest run packages/code/src/cli.golden.test.ts -u';

/** Every `mnema <words> --help` block of the transcript, in its order; the program's own are left out. */
export function helpBlocks(transcript: string): readonly HelpBlock[] {
  const blocks: HelpBlock[] = [];
  let current: { words: string[]; lines: string[] } | undefined;
  for (const line of transcript.split('\n')) {
    const head = /^\$ mnema (.+) --help$/.exec(line);
    if (head !== null) {
      current = { words: (head[1] as string).split(' '), lines: [] };
      blocks.push(current);
      continue;
    }
    if (line.startsWith('$ ') || line.startsWith('### ')) {
      current = undefined;
      continue;
    }
    if (current !== undefined && line.startsWith('|')) {
      current.lines.push(line.slice(line.startsWith('| ') ? 2 : 1));
    }
  }
  return blocks;
}

/** The group `mnema --help` puts each top verb in, by the verb's name. */
export function helpGroups(transcript: string): ReadonlyMap<string, string> {
  const program = transcript.split('$ mnema --help\n')[1]?.split('\n$ ')[0] ?? '';
  const groups = new Map<string, string>();
  let group: string | undefined;
  for (const raw of program.split('\n')) {
    const line = raw.slice(raw.startsWith('| ') ? 2 : 1);
    const heading = /^([A-Z][^:]*):$/.exec(line);
    if (heading !== null) {
      group = ['Usage', 'Options'].includes(heading[1] as string) ? undefined : heading[1];
      continue;
    }
    const verb = /^ {2}([a-z][a-z-]*)\s/.exec(line);
    if (group !== undefined && group !== 'Help' && verb !== null) {
      groups.set(verb[1] as string, group);
    }
  }
  return groups;
}

/** The file a verb's page is written to, from the folder of the verbs. */
export function verbFile(words: readonly string[]): string {
  return `${words.join('-')}.md`;
}

/** The file a tool's page is written to, from the folder of the tools. */
export function toolFile(name: string): string {
  return `${name.replaceAll('_', '-')}.md`;
}

/** The part written by hand of a committed page, markers included; an empty part for a new page. */
export function handPart(committed: string | undefined): string {
  if (committed !== undefined) {
    const from = committed.indexOf(HAND_BEGIN);
    const to = committed.indexOf(HAND_END, from + 1);
    if (from !== -1 && to > from) return committed.slice(from, to + HAND_END.length);
  }
  return `${HAND_BEGIN}\n${HAND_END}`;
}

/** Text outside code spans made safe for a Markdown table cell: no `|` and no `<` read as HTML. */
function cell(text: string): string {
  return text
    .split('`')
    .map((part, at) => (at % 2 === 0 ? part.replaceAll('<', '&lt;') : part))
    .join('`')
    .replaceAll('|', '\\|');
}

/** The entries of one section of a help block (`Arguments:`, `Options:`, `Commands:`). */
function entriesOf(lines: readonly string[], section: string): { term: string; text: string }[] {
  const start = lines.indexOf(`${section}:`);
  if (start === -1) return [];
  const entries: { term: string; text: string }[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || !line.startsWith('  ')) break;
    const entry = /^ {2}(\S(?:.*?\S)?)(?: {2,}(\S.*))?$/.exec(line);
    const last = entries.at(-1);
    if (!line.startsWith('   ') && entry !== null) {
      entries.push({ term: entry[1] as string, text: entry[2] ?? '' });
    } else if (last !== undefined) {
      last.text = `${last.text} ${line.trim()}`.trim();
    }
  }
  return entries;
}

/** The sentence under `Usage:`, joined into one line. */
function describedAs(lines: readonly string[]): string {
  const paragraph: string[] = [];
  for (const line of lines.slice(2)) {
    if (line.trim() === '') break;
    paragraph.push(line.trim());
  }
  return paragraph.join(' ');
}

/** The note a tool's page and the index of the tools open with. */
function generatedFrom(source: string): string {
  return `<!-- This page is generated from ${source}: edit it there and run \`${UPDATE}\`. -->`;
}

/**
 * The note a verb's page and the index of the verbs open with. The help transcript is itself
 * generated, so the note sends a reader to where a command's help is written, and names the two
 * runs that carry an edit there to the transcript and then to the page.
 */
const GENERATED_FROM_THE_HELP = `<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run \`${HELP_UPDATE}\` (which rewrites ${HELP_SOURCE}) and \`${UPDATE}\`. -->`;

/** The page of one verb. */
export function verbPage(
  block: HelpBlock,
  every: readonly HelpBlock[],
  groups: ReadonlyMap<string, string>,
  committed: string | undefined,
): string {
  const name = `mnema ${block.words.join(' ')}`;
  const group = groups.get(block.words[0] as string) ?? 'Help';
  const parent = every.find(
    (one) =>
      one.words.length === block.words.length - 1 &&
      one.words.every((word, at) => word === block.words[at]),
  );
  const children = every.filter(
    (one) =>
      one.words.length === block.words.length + 1 &&
      block.words.every((word, at) => word === one.words[at]),
  );
  const out = [`# ${name}`, '', GENERATED_FROM_THE_HELP, ''];
  out.push(cell(describedAs(block.lines)), '');
  const under =
    parent === undefined
      ? ''
      : ` · a command of [\`mnema ${parent.words.join(' ')}\`](${verbFile(parent.words)})`;
  out.push(`In the help under **${group}**${under}.`, '');
  const table = (title: string, head: string, entries: { term: string; text: string }[]) => {
    if (entries.length === 0) return;
    out.push(`## ${title}`, '', `| ${head} | What it does |`, '| --- | --- |');
    for (const { term, text } of entries) out.push(`| \`${term}\` | ${cell(text)} |`);
    out.push('');
  };
  table('Arguments', 'Argument', entriesOf(block.lines, 'Arguments'));
  table(
    'Options',
    'Option',
    entriesOf(block.lines, 'Options').filter(({ term }) => term !== '-h, --help'),
  );
  if (children.length > 0) {
    out.push('## Commands', '', '| Command | What it does |', '| --- | --- |');
    for (const child of children) {
      out.push(
        `| [\`mnema ${child.words.join(' ')}\`](${verbFile(child.words)}) | ${cell(describedAs(child.lines))} |`,
      );
    }
    out.push('');
  }
  out.push(handPart(committed), '', '## The whole help', '', '```text');
  out.push(...block.lines.map((line) => line.trimEnd()));
  out.push('```', '');
  return out.join('\n');
}

/** The index of the verbs: every top verb in the help's groups, with its commands under it. */
export function commandsIndex(
  every: readonly HelpBlock[],
  groups: ReadonlyMap<string, string>,
  committed: string | undefined,
): string {
  const out = [
    '# Commands',
    '',
    GENERATED_FROM_THE_HELP,
    '',
    'One page per command of `mnema`, in the groups `mnema --help` lists them in. Each page',
    'carries the help the command prints, word for word.',
    '',
    handPart(committed),
    '',
  ];
  const tops = every.filter((one) => one.words.length === 1);
  for (const group of new Set(groups.values())) {
    out.push(`## ${group}`, '');
    for (const top of tops.filter((one) => groups.get(one.words[0] as string) === group)) {
      out.push(
        `- [mnema ${top.words[0]}](cli/${verbFile(top.words)}): ${cell(describedAs(top.lines))}`,
      );
      const below = every.filter((one) => one.words.length > 1 && one.words[0] === top.words[0]);
      for (const child of below) {
        out.push(
          `  - [mnema ${child.words.join(' ')}](cli/${verbFile(child.words)}): ${cell(describedAs(child.lines))}`,
        );
      }
    }
    out.push('');
  }
  return out.join('\n');
}

/** What a property of an input schema takes, in words. */
function typeOf(property: SchemaProperty): string {
  if (property.enum !== undefined) {
    return `one of ${property.enum.map((value) => `\`${String(value)}\``).join(', ')}`;
  }
  const bounds: string[] = [];
  if (property.minLength !== undefined) {
    bounds.push(`at least ${property.minLength} character${property.minLength === 1 ? '' : 's'}`);
  }
  if (property.exclusiveMinimum !== undefined) bounds.push(`above ${property.exclusiveMinimum}`);
  if (property.maximum !== undefined) bounds.push(`at most ${property.maximum}`);
  const type = property.type ?? 'any';
  return bounds.length === 0 ? type : `${type}, ${bounds.join(', ')}`;
}

/** The four hints a client reads, as the server serves them. */
const HINTS = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const;

const SERVER_SOURCE =
  'what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts)';

/** The page of one tool. */
export function toolPage(tool: ServedTool, committed: string | undefined): string {
  const out = [`# ${tool.name}`, '', generatedFrom(SERVER_SOURCE), ''];
  if (tool.title !== undefined) out.push(`**${cell(tool.title)}**`, '');
  out.push(cell(tool.description ?? ''), '', '## Parameters', '');
  const properties = Object.entries(tool.inputSchema.properties ?? {});
  if (properties.length === 0) {
    out.push('It takes none.', '');
  } else {
    out.push('| Parameter | Type | Required | What it is |', '| --- | --- | :---: | --- |');
    for (const [name, property] of properties) {
      const required = tool.inputSchema.required?.includes(name) ? 'yes' : 'no';
      out.push(
        `| \`${name}\` | ${cell(typeOf(property))} | ${required} | ${cell(property.description ?? '')} |`,
      );
    }
    out.push('');
  }
  out.push('## Annotations', '', '| Hint | Value |', '| --- | :---: |');
  for (const hint of HINTS) out.push(`| \`${hint}\` | ${String(tool.annotations?.[hint] ?? '')} |`);
  out.push('', handPart(committed), '');
  return out.join('\n');
}

/** The index of the tools: the ones that read, then the ones that may write, in the order served. */
export function toolsIndex(tools: readonly ServedTool[], committed: string | undefined): string {
  const out = [
    '# MCP tools',
    '',
    generatedFrom(SERVER_SOURCE),
    '',
    'One page per tool the mnema MCP server serves, with the description, the parameters and the',
    'annotations an agent host is handed.',
    '',
    handPart(committed),
    '',
  ];
  const families: readonly [string, (tool: ServedTool) => boolean][] = [
    ['Read only', (tool) => tool.annotations?.readOnlyHint === true],
    ['May write to the record', (tool) => tool.annotations?.readOnlyHint !== true],
  ];
  for (const [family, holds] of families) {
    out.push(`## ${family}`, '');
    for (const tool of tools.filter(holds)) {
      out.push(`- [${tool.name}](mcp/${toolFile(tool.name)}): ${cell(tool.title ?? '')}`);
    }
    out.push('');
  }
  return out.join('\n');
}

/** Whether a page is one of the generated reference pages. */
export function isAReferencePage(page: string): boolean {
  return (
    /^docs\/reference\/(cli|mcp)\/[^/]+\.md$/.test(page) ||
    page === 'docs/reference/commands.md' ||
    page === 'docs/reference/mcp-tools.md'
  );
}

/**
 * What a person wrote on a page, for the guards that read what a page hands over: on a generated
 * reference page every line outside the part written by hand is blanked (the lines keep their
 * numbers), because what the generator wrote there is the help and the tool definitions, which
 * the same guards read at their source; any other page is returned whole.
 */
export function writtenByHand(page: string, text: string): string {
  if (!isAReferencePage(page)) return text;
  let inside = false;
  return text
    .split('\n')
    .map((line) => {
      if (line === HAND_BEGIN) inside = true;
      const kept = inside && line !== HAND_BEGIN && line !== HAND_END ? line : '';
      if (line === HAND_END) inside = false;
      return kept;
    })
    .join('\n');
}
