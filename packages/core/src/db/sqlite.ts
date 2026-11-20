/**
 * The SQLite handle behind the projection cache, with the pragmas a
 * concurrent-reader, single-writer local cache wants.
 *
 * This database is a PURE CACHE: every row in it is derived from the chain and
 * can be thrown away and rebuilt at any time. It is never the source of truth
 * and is never committed. So there are no data migrations here, when the shape
 * changes, the tables are dropped and replayed, not migrated. The pragmas below
 * are about safe, fast local access, nothing more.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * A prepared statement as the stores use it. Rows come back as what the driver makes of them and
 * each store says what it expects of its own, so `get` and `all` are `unknown` and the one place
 * that reads a row names its shape; parameters are the driver's own (positional or one object of
 * named values) and it is the driver that refuses what it cannot bind.
 */
export interface SqliteStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): {
    readonly changes: number | bigint;
    readonly lastInsertRowid: number | bigint;
  };
}

/**
 * The handle the cache is held in: `node:sqlite`'s, which the runtime ships, with `prepare`
 * typed by {@link SqliteStatement}.
 */
export type SqliteDatabase = Omit<DatabaseSync, 'prepare'> & {
  prepare(sql: string): SqliteStatement;
};

/**
 * What the write-ahead log is cut back to once a checkpoint has emptied it: 4 MiB, the size the
 * default auto-checkpoint (1000 pages of 4 KiB) lets it grow to anyway.
 *
 * Without a limit SQLite keeps the file at the largest size it ever reached, and a log that once
 * held a replay of the whole record stays that big for as long as a process holds the database
 * open, which for an MCP server is days.
 */
export const WAL_SIZE_LIMIT_BYTES = 4 * 1024 * 1024;

/**
 * Where SQLite puts the temporary files a big sort or index build spills into: the directory of
 * the cache file, unless the person chose one.
 *
 * SQLite's own default is `/var/tmp` when `$TMPDIR` is unset, which is a place on the machine
 * that nothing here owns and that is often small: a probe saw 37 MB of `etilqs_*` files land
 * there. The cache's own directory already exists, is writable (the file is in it), is
 * git-ignored and is the file system the cache is on. `$SQLITE_TMPDIR` and `$TMPDIR` are the
 * person's and keep winning: the setting is made only when neither is set. It is process-wide in
 * SQLite, so the last cache opened decides; a directory that is gone is passed over by SQLite
 * for the next place it knows.
 */
function spillBeside(db: DatabaseSync, path: string): void {
  if (process.env.SQLITE_TMPDIR !== undefined || process.env.TMPDIR !== undefined) return;
  try {
    db.exec(`PRAGMA temp_store_directory = '${dirname(path).replaceAll("'", "''")}'`);
  } catch {
    // A build of SQLite without the setting spills where it always did.
  }
}

/**
 * Cuts the write-ahead log back to nothing, and says whether it did.
 *
 * It does not wait: a reader (the command line, another server) holding the log blocks it, and
 * the answer is `false` rather than a call that stalls an event loop; the next idle moment tries
 * again. Never run it inside a read: it takes the write lock for as long as it copies.
 */
export function truncateWal(db: SqliteDatabase): boolean {
  db.exec('PRAGMA busy_timeout = 0');
  try {
    const row = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get() as { busy?: number } | undefined;
    return row !== undefined && Number(row.busy) === 0;
  } catch {
    return false;
  } finally {
    db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  }
}

/** How long a blocked writer waits on a busy database before giving up. */
export const BUSY_TIMEOUT_MS = 5000;

/** An in-memory database path: a cache that lives only for the process. */
export const IN_MEMORY = ':memory:';

/**
 * Opens the cache database at `path` (or `:memory:`) with the standard pragmas:
 *   - `journal_mode = WAL`: concurrent readers alongside one writer.
 *   - `synchronous = NORMAL`: safe under WAL, faster than FULL. A crash can lose
 *     the last transaction; acceptable, because the cache is rebuilt from the
 *     chain, which is the durable record.
 *   - `foreign_keys = ON`: enforce referential integrity between cache tables.
 *   - `busy_timeout`: tolerate brief writer contention instead of erroring.
 *
 * Creates the parent directory first: the cache lives under a git-ignored state
 * directory that may not exist yet on a fresh checkout, and SQLite
 * fails with a bare error when the folder is missing.
 */
export function openDatabase(path: string): SqliteDatabase {
  if (path !== IN_MEMORY) {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path, {
    enableForeignKeyConstraints: true,
    timeout: BUSY_TIMEOUT_MS,
  });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(`PRAGMA journal_size_limit = ${WAL_SIZE_LIMIT_BYTES}`);
  if (path !== IN_MEMORY) spillBeside(db, path);
  return rememberingStatements(db);
}

/** How many distinct statements a handle remembers before it starts over. */
const REMEMBERED_STATEMENTS = 256;

/**
 * Makes `prepare` hand back the statement it already compiled for the same text.
 *
 * Every keyed read of a projection (`getTask`, `getDecision`, …) prepared its SQL on each call, and
 * preparing is most of what a keyed lookup costs: a census that resolves every rule of a record
 * through up to five of them paid it per address, measured in the order of 100 µs each. A statement is a compiled plan and holds no result, so
 * running it again is what running it once was; one that was prepared over a table a rebuild then
 * dropped is recompiled by SQLite itself on its next run.
 *
 * The memory is bounded: the statements this package builds are a fixed set plus the search's
 * combinations of conditions, and a handle that somehow saw more than the bound starts again.
 */
function rememberingStatements(db: DatabaseSync): DatabaseSync {
  const prepare = db.prepare.bind(db);
  const known = new Map<string, ReturnType<DatabaseSync['prepare']>>();
  db.prepare = (sql: string) => {
    const remembered = known.get(sql);
    if (remembered !== undefined) return remembered;
    const statement = prepare(sql);
    if (known.size >= REMEMBERED_STATEMENTS) known.clear();
    known.set(sql, statement);
    return statement;
  };
  return db;
}

/**
 * Runs `work` as one transaction and returns what it returns; if it throws, everything it wrote
 * is undone and the error goes up.
 *
 * `node:sqlite` has no transaction helper, so this is the one. Called on a handle that is already
 * inside a transaction (`advance` runs inside the refresh's), it is a savepoint instead: the
 * inner failure rolls back to where it began and the outer transaction decides what to do with
 * the error. `immediate` takes the write lock at `BEGIN`, not at the first write: two processes
 * that mean to write serialize there, rather than one of them finding out mid-way that it
 * cannot.
 */
export function inTransaction<T>(
  db: SqliteDatabase,
  work: () => T,
  options: { readonly immediate?: boolean } = {},
): T {
  if (db.isTransaction) {
    db.exec(`SAVEPOINT ${SAVEPOINT}`);
    try {
      const result = work();
      db.exec(`RELEASE ${SAVEPOINT}`);
      return result;
    } catch (error) {
      // SQLite rolls some failures back whole (`INSERT OR ROLLBACK`, a full disk): the savepoint is
      // gone with the transaction, and naming it would put its own error in place of this one.
      if (db.isTransaction) {
        db.exec(`ROLLBACK TO ${SAVEPOINT}`);
        db.exec(`RELEASE ${SAVEPOINT}`);
      }
      throw error;
    }
  }
  db.exec(options.immediate === true ? 'BEGIN IMMEDIATE' : 'BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    // SQLite rolls some failures back by itself; there is then nothing left to undo.
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}

const SAVEPOINT = 'mnema_nested';
