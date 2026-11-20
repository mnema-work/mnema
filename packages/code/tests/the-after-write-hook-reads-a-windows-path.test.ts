/**
 * THE AFTER-A-WRITE HOOK READS A WINDOWS PATH: THE FILTER IN FRONT OF THE VERB TESTS FORWARD SLASHES.
 *
 * `plugin/hooks/after-a-write.mjs` ends, before it starts `mnema`, for every path that cannot be a
 * note of the host's memory or a file of decisions. Its patterns and its "inside the project" guard
 * are written with `/`, and a Windows host hands `C:\p\x.md` and `C:\p`: the guard was dead (a
 * `.md` inside the project reached the verb) and `.claude\rules\x` never matched. The path and the
 * project are read with `\` as `/` for the checks, and the payload still goes to the verb byte for
 * byte. A fake `mnema` stands where the product would and keeps what it was handed.
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HOOK = join(
  fileURLToPath(new URL('../../../', import.meta.url)),
  'plugin',
  'hooks',
  'after-a-write.mjs',
);

describe.skipIf(process.platform === 'win32')(
  'the after-a-write hook with a Windows-shaped path',
  () => {
    let directory = '';
    let handed = '';
    let fake = '';
    beforeAll(() => {
      directory = mkdtempSync(join(tmpdir(), 'mnema-after-write-'));
      handed = join(directory, 'handed.txt');
      fake = join(directory, 'mnema');
      writeFileSync(
        fake,
        `#!/bin/sh\ncase "$1" in --identify) echo "@mnema/code 999.0.0"; exit 0;; esac\n/bin/cat > "${handed}"\n`,
      );
      chmodSync(fake, 0o755);
      mkdirSync(join(directory, 'C:\\p'));
      mkdirSync(join(directory, 'c:\\p'));
      mkdirSync(join(directory, 'p'));
    });
    afterAll(() => rmSync(directory, { recursive: true, force: true }));

    /** The payload the verb was handed for a write to `file` in `project`, or null when it was not run. */
    function handedFor(file: string, project: string): string | null {
      rmSync(handed, { force: true });
      const payload = JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: file, content: 'x' },
      });
      spawnSync(process.execPath, [HOOK], {
        cwd: directory,
        input: payload,
        encoding: 'utf-8',
        env: {
          PATH: process.env.PATH ?? '',
          HOME: directory,
          CLAUDE_PROJECT_DIR: project,
          CLAUDE_PLUGIN_OPTION_MNEMA_PATH: fake,
        },
      });
      if (!existsSync(handed)) return null;
      expect(readFileSync(handed, 'utf-8')).toBe(payload);
      return payload;
    }

    it('reaches the verb for a rules file without an extension, with backslashes', () => {
      expect(handedFor('C:\\p\\.claude\\rules\\x', 'C:\\p')).not.toBeNull();
      expect(handedFor('C:\\p\\docs\\adr\\0001.md', 'C:\\p')).not.toBeNull();
    });

    it('does not reach the verb for a .md file inside the project that is no decision file', () => {
      expect(handedFor('C:\\p\\notes\\x.md', 'C:\\p')).toBeNull();
      expect(handedFor('c:\\p\\notes\\x.md', 'C:\\p')).toBeNull();
      expect(handedFor('C:\\p\\notes\\x.md', 'c:\\p')).toBeNull();
    });

    it('reaches the verb for a .md file outside the project, as a moved memory directory', () => {
      expect(handedFor('D:\\memory-elsewhere\\x.md', 'C:\\p')).not.toBeNull();
    });

    it('still reads a POSIX path as it always did', () => {
      const project = join(directory, 'p');
      expect(handedFor(`${project}/.claude/rules/x`, project)).not.toBeNull();
      expect(handedFor(`${project}/notes/x.md`, project)).toBeNull();
    });
  },
);
