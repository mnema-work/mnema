/**
 * The write-ahead log of the cache is bounded, and cutting it back never breaks a reader.
 *
 *   - `journal_size_limit` is set on every handle (the log is cut to it once a checkpoint empties it);
 *   - `truncateWal` empties the log file, never waits for a reader, and says whether it did;
 *   - 1,000 writes through a handle whose log is cut back at the idle moments leave a log under the
 *     limit, where the same 1,000 writes leave one many times larger;
 *   - a second connection (the command line) reading while the cut is made reads what was written
 *     and is not refused;
 *   - temporary files go beside the cache file, unless the person chose a place.
 */

import { existsSync, mkdtempSync, readdirSync, readlinkSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, truncateWal, WAL_SIZE_LIMIT_BYTES } from './sqlite.js';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mnema-wal-'));
  file = join(dir, 'projection.db');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const wal = (): number => (existsSync(`${file}-wal`) ? statSync(`${file}-wal`).size : 0);

describe('the log of a cache on disk', () => {
  it('carries a size limit', () => {
    const db = openDatabase(file);
    const row = db.prepare('PRAGMA journal_size_limit').get() as { journal_size_limit: number };
    expect(row.journal_size_limit).toBe(4 * 1024 * 1024);
    expect(WAL_SIZE_LIMIT_BYTES).toBe(4 * 1024 * 1024);
    db.close();
  });

  it('is emptied by truncateWal, which says so', () => {
    const db = openDatabase(file);
    db.exec('CREATE TABLE t (a BLOB)');
    // Held open by a reader, so the auto-checkpoint cannot recycle it before the cut.
    const reader = openDatabase(file);
    reader.exec('BEGIN');
    reader.prepare('SELECT count(*) FROM t').get();
    for (let each = 0; each < 200; each += 1) {
      db.prepare('INSERT INTO t VALUES (randomblob(2000))').run();
    }
    expect(wal()).toBeGreaterThan(0);
    // A reader mid-transaction holds the log: no cut, and no wait.
    const started = Date.now();
    expect(truncateWal(db)).toEqual({
      cut: false,
      because: 'busy: another connection holds the log (a reader or a writer)',
    });
    expect(Date.now() - started).toBeLessThan(1000);
    reader.exec('COMMIT');
    reader.close();
    expect(truncateWal(db)).toEqual({ cut: true });
    expect(wal()).toBe(0);
    db.close();
  });

  it('stays under the limit over 1,000 writes cut back at idle moments, and a reader reads on', () => {
    const writer = openDatabase(file);
    const reader = openDatabase(file);
    writer.exec('CREATE TABLE t (n INTEGER, pad BLOB)');
    let widest = 0;
    for (let each = 1; each <= 1000; each += 1) {
      writer.prepare('INSERT INTO t VALUES (?, randomblob(8000))').run(each);
      widest = Math.max(widest, wal());
      // The idle moment, every 25 writes.
      if (each % 25 === 0) {
        truncateWal(writer);
        const seen = reader.prepare('SELECT count(*) AS n FROM t').get() as { n: number };
        expect(seen.n).toBe(each);
      }
    }
    expect(widest).toBeLessThanOrEqual(WAL_SIZE_LIMIT_BYTES + 64 * 1024);
    truncateWal(writer);
    expect(wal()).toBe(0);
    reader.close();
    writer.close();
  });

  it('spills temporary files beside the cache file when nobody chose a place', () => {
    const saved = { sqlite: process.env.SQLITE_TMPDIR, tmp: process.env.TMPDIR };
    delete process.env.SQLITE_TMPDIR;
    delete process.env.TMPDIR;
    try {
      const db = openDatabase(file);
      db.exec('PRAGMA cache_size = 10; CREATE TABLE t (a BLOB)');
      db.exec(
        'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 200000) INSERT INTO t SELECT randomblob(100) FROM c',
      );
      // What SQLite was told, on every platform.
      const told = db.prepare('PRAGMA temp_store_directory').get() as {
        temp_store_directory: string;
      };
      expect(told.temp_store_directory).toBe(dir);
      // And where the files really go, where the build of SQLite keeps temporary files on disk at all.
      db.exec('PRAGMA temp_store = FILE');
      const onDisk = (db.prepare('PRAGMA temp_store').get() as { temp_store: number }).temp_store === 1;
      if (process.platform === 'linux' && onDisk) {
        const sorted = db.prepare('SELECT a FROM t ORDER BY a') as unknown as {
          iterate(): Iterable<unknown>;
        };
        let spilledTo: string[] = [];
        for (const _row of sorted.iterate()) {
          spilledTo = readdirSync('/proc/self/fd')
            .map((fd) => {
              try {
                return readlinkSync(join('/proc/self/fd', fd));
              } catch {
                return '';
              }
            })
            .filter((target) => target.includes('etilqs_'));
          break;
        }
        expect(spilledTo.length).toBeGreaterThan(0);
        for (const target of spilledTo) expect(target.startsWith(`${dir}/`)).toBe(true);
      }
      db.close();
    } finally {
      if (saved.sqlite !== undefined) process.env.SQLITE_TMPDIR = saved.sqlite;
      if (saved.tmp !== undefined) process.env.TMPDIR = saved.tmp;
    }
  });
});
