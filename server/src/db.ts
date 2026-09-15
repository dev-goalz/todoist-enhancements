import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import SQLite from 'better-sqlite3';
import { Kysely, PostgresDialect, SqliteDialect } from 'kysely';
import pg from 'pg';

/**
 * The database, behind Kysely so the same queries run on SQLite and Postgres.
 *
 * Portability rules the repository sticks to: documents are plain TEXT parsed
 * in TypeScript, columns are only `text` and `integer`, and the only
 * non-basic SQL is `ON CONFLICT DO UPDATE`, `RETURNING` and savepoints, which
 * both engines support.
 */

export interface UsersTable {
  id: string;
  token_hash: string;
  /** The latest revision handed out to this user; also their sync token. */
  rev: number;
  /** The revision at which the user object itself last changed. */
  user_rev: number;
  data: string;
}

export interface ResourcesTable {
  user_id: string;
  type: string;
  id: string;
  rev: number;
  data: string;
}

export interface AppliedCommandsTable {
  user_id: string;
  uuid: string;
  status: string;
}

export interface TempIdsTable {
  user_id: string;
  temp_id: string;
  real_id: string;
}

export interface CompletionsTable {
  user_id: string;
  id: string;
  item_id: string;
  completed_at: string;
  data: string;
}

export interface Database {
  users: UsersTable;
  resources: ResourcesTable;
  applied_commands: AppliedCommandsTable;
  temp_ids: TempIdsTable;
  completions: CompletionsTable;
}

export type Db = Kysely<Database>;

/** A `postgres://` or `postgresql://` URL opens Postgres; anything else is a SQLite file path. */
export function openDatabase(location: string): Db {
  if (/^postgres(ql)?:\/\//.test(location)) {
    return new Kysely<Database>({
      dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: location }) }),
    });
  }
  return openSqlite(location);
}

export function openSqlite(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const database = new SQLite(path);
  database.pragma('journal_mode = WAL');
  return new Kysely<Database>({ dialect: new SqliteDialect({ database }) });
}

/** Creates the tables. Safe to run on every start. */
export async function migrate(db: Db): Promise<void> {
  await db.schema.createTable('users').ifNotExists()
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('rev', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('user_rev', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('data', 'text', (c) => c.notNull())
    .execute();

  await db.schema.createTable('resources').ifNotExists()
    .addColumn('user_id', 'text', (c) => c.notNull())
    .addColumn('type', 'text', (c) => c.notNull())
    .addColumn('id', 'text', (c) => c.notNull())
    .addColumn('rev', 'integer', (c) => c.notNull())
    .addColumn('data', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('resources_pk', ['user_id', 'type', 'id'])
    .execute();
  await db.schema.createIndex('resources_rev').ifNotExists()
    .on('resources').columns(['user_id', 'type', 'rev'])
    .execute();

  await db.schema.createTable('applied_commands').ifNotExists()
    .addColumn('user_id', 'text', (c) => c.notNull())
    .addColumn('uuid', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('applied_commands_pk', ['user_id', 'uuid'])
    .execute();

  await db.schema.createTable('temp_ids').ifNotExists()
    .addColumn('user_id', 'text', (c) => c.notNull())
    .addColumn('temp_id', 'text', (c) => c.notNull())
    .addColumn('real_id', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('temp_ids_pk', ['user_id', 'temp_id'])
    .execute();

  await db.schema.createTable('completions').ifNotExists()
    .addColumn('user_id', 'text', (c) => c.notNull())
    .addColumn('id', 'text', (c) => c.notNull())
    .addColumn('item_id', 'text', (c) => c.notNull())
    .addColumn('completed_at', 'text', (c) => c.notNull())
    .addColumn('data', 'text', (c) => c.notNull())
    .addPrimaryKeyConstraint('completions_pk', ['user_id', 'id'])
    .execute();
  await db.schema.createIndex('completions_at').ifNotExists()
    .on('completions').columns(['user_id', 'completed_at'])
    .execute();
  await db.schema.createIndex('completions_item').ifNotExists()
    .on('completions').columns(['user_id', 'item_id'])
    .execute();
}
