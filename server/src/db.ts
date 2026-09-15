import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import SQLite from 'better-sqlite3';
import { Kysely, PostgresDialect, SqliteDialect } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
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
  /** The token the account was created with. Tokens are looked up in api_tokens; this is kept for older databases. */
  token_hash: string;
  /** Lower-cased; null for an account made before sign-in existed. */
  email: string | null;
  /** scrypt, see passwords.ts; null when the account has no password. */
  password_hash: string | null;
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

export interface ApiTokensTable {
  token_hash: string;
  user_id: string;
  created_at: string;
}

export interface Database {
  users: UsersTable;
  api_tokens: ApiTokensTable;
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

const MIGRATIONS: Record<string, Migration> = {
  // Database is `any` here: a migration describes the schema as it was then.
  '001-initial': {
    async up(db: Kysely<any>) {
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
    },
  },

  '002-accounts': {
    async up(db: Kysely<any>) {
      await db.schema.alterTable('users').addColumn('email', 'text').execute();
      await db.schema.alterTable('users').addColumn('password_hash', 'text').execute();
      await db.schema.createTable('api_tokens')
        .addColumn('token_hash', 'text', (c) => c.primaryKey())
        .addColumn('user_id', 'text', (c) => c.notNull())
        .addColumn('created_at', 'text', (c) => c.notNull())
        .execute();
      await db.schema.createIndex('api_tokens_user').on('api_tokens').column('user_id').execute();

      // Existing tokens keep working, and each account takes the email it was
      // created with, unless an earlier account already has that address.
      const now = new Date().toISOString();
      const seen = new Set<string>();
      const users = await db.selectFrom('users').select(['id', 'token_hash', 'data']).orderBy('id').execute();
      for (const user of users) {
        await db.insertInto('api_tokens')
          .values({ token_hash: user.token_hash, user_id: user.id, created_at: now })
          .execute();
        const email = String(JSON.parse(user.data).email ?? '').trim().toLowerCase();
        if (email && !seen.has(email)) {
          seen.add(email);
          await db.updateTable('users').set({ email }).where('id', '=', user.id).execute();
        }
      }
      await db.schema.createIndex('users_email').unique().on('users').column('email').execute();
    },
  },
};

/** Brings the schema up to date. Safe to run on every start. */
export async function migrate(db: Db): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => MIGRATIONS },
  });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
}
