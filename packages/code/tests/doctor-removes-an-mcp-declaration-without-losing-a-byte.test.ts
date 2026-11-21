/**
 * `src/commands/doctor-mcp.ts`: the one edit `mnema upgrade` makes to `~/.claude.json` and to a `.mcp.json`. The
 * first holds the host's own state beside the servers, so what is asserted is the TEXT that comes out: every byte
 * of every other member where it was, the file still strict JSON, and a refusal, with nothing written, for what the
 * edit does not know how to touch.
 */

import { describe, expect, it } from 'vitest';
import { planRemoval } from '../src/commands/doctor-mcp.js';

const MNEMA = [
  '      "mnema": {',
  '        "command": "mnema",',
  '        "args": ["mcp"]',
  '      }',
];

function removed(text: string, path: string[], names: string[]): string {
  const plan = planRemoval(text, path, names);
  if (plan.kind !== 'change') throw new Error(`expected a change, got ${plan.kind}`);
  return plan.text;
}

describe('dropping an entry', () => {
  it('cuts the lines of the entry and no other byte of a file the host wrote', () => {
    const before = [
      '{',
      '  "numStartups": 41,',
      '  "mcpServers": {',
      '    "other": { "command": "other-server" },',
      ...MNEMA.map((line) => line.slice(2))
        .join('\n')
        .split('\n'),
      '  },',
      '  "tips": ["a", "b"]',
      '}',
      '',
    ].join('\n');
    const after = removed(before, ['mcpServers'], ['mnema']);
    expect(after).toBe(
      [
        '{',
        '  "numStartups": 41,',
        '  "mcpServers": {',
        '    "other": { "command": "other-server" }',
        '  },',
        '  "tips": ["a", "b"]',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('keeps the commas right when the entry is first, in the middle, or alone', () => {
    const first = '{\n  "s": {\n    "mnema": {"a": 1},\n    "x": 2\n  }\n}';
    expect(removed(first, ['s'], ['mnema'])).toBe('{\n  "s": {\n    "x": 2\n  }\n}');
    const middle = '{\n  "s": {\n    "x": 1,\n    "mnema": {"a": 1},\n    "y": 2\n  }\n}';
    expect(removed(middle, ['s'], ['mnema'])).toBe('{\n  "s": {\n    "x": 1,\n    "y": 2\n  }\n}');
    const alone = '{\n  "s": {\n    "mnema": {"a": 1}\n  },\n  "t": 1\n}';
    expect(JSON.parse(removed(alone, ['s'], ['mnema']))).toEqual({ s: {}, t: 1 });
  });

  it('cuts one line of a file with no line breaks, and a nested table by its path', () => {
    const minified =
      '{"a":1,"projects":{"/p":{"mcpServers":{"mnema":{"x":1},"keep":{"y":2}},"z":3}},"b":4}';
    expect(removed(minified, ['projects', '/p', 'mcpServers'], ['mnema'])).toBe(
      '{"a":1,"projects":{"/p":{"mcpServers":{"keep":{"y":2}},"z":3}},"b":4}',
    );
    const last = '{"s":{"keep":1,"mnema":2}}';
    expect(removed(last, ['s'], ['mnema'])).toBe('{"s":{"keep":1}}');
  });

  it('leaves a same-named entry of another table alone', () => {
    const text =
      '{\n  "mcpServers": {\n    "mnema": 1\n  },\n  "projects": {\n    "/p": {\n      "mcpServers": {\n        "mnema": 2\n      }\n    }\n  }\n}';
    const after = removed(text, ['projects', '/p', 'mcpServers'], ['mnema']);
    expect(JSON.parse(after)).toEqual({
      mcpServers: { mnema: 1 },
      projects: { '/p': { mcpServers: {} } },
    });
  });

  it('changes nothing the second time', () => {
    const once = removed('{\n  "s": {\n    "mnema": 1\n  }\n}', ['s'], ['mnema']);
    expect(planRemoval(once, ['s'], ['mnema']).kind).toBe('unchanged');
    expect(planRemoval('{"a":1}', ['s'], ['mnema']).kind).toBe('unchanged');
  });
});

describe('a file it does not know how to edit', () => {
  it('is refused with the reason, whatever its shape', () => {
    const jsonc = planRemoval('{\n  // mine\n  "s": { "mnema": 1 }\n}', ['s'], ['mnema']);
    expect(jsonc).toEqual({
      kind: 'refused',
      why: 'the file is not strict JSON, which is all this edits',
    });
    const twice = planRemoval('{"s":{"mnema":1,"mnema":2}}', ['s'], ['mnema']);
    expect(twice).toEqual({ kind: 'refused', why: '“mnema” appears more than once' });
    const notObject = planRemoval('{"s":[1]}', ['s'], ['mnema']);
    expect(notObject).toEqual({ kind: 'refused', why: '“s” is not an object' });
  });
});
