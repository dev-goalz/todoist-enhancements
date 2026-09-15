import { sql, type Kysely } from 'kysely';
import type { Database } from './db';
import type { CommandStatus, CompletedItem, ResourceType, TodoistUser } from './wire';

type Stored = { id: string };

export interface UserRecord {
  id: string;
  rev: number;
  userRev: number;
  data: TodoistUser;
}

let savepointCounter = 0;

/** Every query the server makes. Nothing else touches the database. */
export class Repo {
  constructor(private readonly db: Kysely<Database>) {}

  /** Runs `fn` in a transaction, handing it a repository bound to that transaction. */
  transaction<T>(fn: (repo: Repo) => Promise<T>): Promise<T> {
    return this.db.transaction().execute((trx) => fn(new Repo(trx)));
  }

  /**
   * Runs `fn` inside a savepoint of the current transaction. If it throws, its
   * writes are undone and the error is rethrown; earlier writes are kept.
   */
  async savepoint<T>(fn: () => Promise<T>): Promise<T> {
    const name = sql.raw(`sp_${++savepointCounter}`);
    await sql`savepoint ${name}`.execute(this.db);
    try {
      const result = await fn();
      await sql`release savepoint ${name}`.execute(this.db);
      return result;
    } catch (error) {
      await sql`rollback to savepoint ${name}`.execute(this.db);
      await sql`release savepoint ${name}`.execute(this.db);
      throw error;
    }
  }

  /* ---------- Users ---------- */

  async insertUser(
    id: string, tokenHash: string, data: TodoistUser, passwordHash: string | null,
  ): Promise<void> {
    await this.db.insertInto('users')
      .values({
        id,
        token_hash: tokenHash,
        email: data.email.trim().toLowerCase(),
        password_hash: passwordHash,
        rev: 0,
        user_rev: 0,
        data: JSON.stringify(data),
      })
      .execute();
    await this.addToken(id, tokenHash);
  }

  async findUserByTokenHash(tokenHash: string): Promise<UserRecord | null> {
    const row = await this.db.selectFrom('api_tokens')
      .innerJoin('users', 'users.id', 'api_tokens.user_id')
      .select(['users.id', 'users.rev', 'users.user_rev', 'users.data'])
      .where('api_tokens.token_hash', '=', tokenHash)
      .executeTakeFirst();
    return row ? toUser(row) : null;
  }

  async findUserByEmail(email: string): Promise<(UserRecord & { passwordHash: string | null }) | null> {
    const row = await this.db.selectFrom('users')
      .select(['id', 'rev', 'user_rev', 'data', 'password_hash'])
      .where('email', '=', email.trim().toLowerCase())
      .executeTakeFirst();
    return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.db.updateTable('users').set({ password_hash: passwordHash }).where('id', '=', userId).execute();
  }

  /* ---------- API tokens, one per signed-in device ---------- */

  async addToken(userId: string, tokenHash: string): Promise<void> {
    await this.db.insertInto('api_tokens')
      .values({ token_hash: tokenHash, user_id: userId, created_at: new Date().toISOString() })
      .execute();
  }

  async revokeToken(tokenHash: string): Promise<void> {
    await this.db.deleteFrom('api_tokens').where('token_hash', '=', tokenHash).execute();
  }

  async revokeAllTokens(userId: string): Promise<void> {
    await this.db.deleteFrom('api_tokens').where('user_id', '=', userId).execute();
  }

  async getUser(id: string): Promise<UserRecord> {
    const row = await this.db.selectFrom('users').selectAll()
      .where('id', '=', id).executeTakeFirst();
    if (!row) throw new Error(`No user ${id}`);
    return toUser(row);
  }

  async setUserData(id: string, data: TodoistUser, rev: number): Promise<void> {
    await this.db.updateTable('users')
      .set({ data: JSON.stringify(data), user_rev: rev })
      .where('id', '=', id).execute();
  }

  /**
   * Opens a new revision for a user; every write in one batch carries it. On
   * Postgres the row lock this takes also serializes concurrent batches.
   */
  async bumpRev(userId: string): Promise<number> {
    const row = await this.db.updateTable('users')
      .set((eb) => ({ rev: eb('rev', '+', 1) }))
      .where('id', '=', userId)
      .returning('rev')
      .executeTakeFirstOrThrow();
    return Number(row.rev);
  }

  /* ---------- Resources ---------- */

  async get<T extends Stored>(userId: string, type: ResourceType, id: string): Promise<T | null> {
    const row = await this.db.selectFrom('resources').select('data')
      .where('user_id', '=', userId).where('type', '=', type).where('id', '=', id)
      .executeTakeFirst();
    return row ? (JSON.parse(row.data) as T) : null;
  }

  async put<T extends Stored>(userId: string, type: ResourceType, value: T, rev: number): Promise<void> {
    const data = JSON.stringify(value);
    await this.db.insertInto('resources')
      .values({ user_id: userId, type, id: value.id, rev, data })
      .onConflict((oc) => oc.columns(['user_id', 'type', 'id']).doUpdateSet({ rev, data }))
      .execute();
  }

  async list<T extends Stored>(userId: string, type: ResourceType): Promise<T[]> {
    const rows = await this.db.selectFrom('resources').select('data')
      .where('user_id', '=', userId).where('type', '=', type)
      .orderBy('rev').orderBy('id')
      .execute();
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  async changedSince<T extends Stored>(userId: string, type: ResourceType, since: number): Promise<T[]> {
    const rows = await this.db.selectFrom('resources').select('data')
      .where('user_id', '=', userId).where('type', '=', type).where('rev', '>', since)
      .orderBy('rev').orderBy('id')
      .execute();
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  /* ---------- Command bookkeeping ---------- */

  async findAppliedCommand(userId: string, uuid: string): Promise<CommandStatus | null> {
    const row = await this.db.selectFrom('applied_commands').select('status')
      .where('user_id', '=', userId).where('uuid', '=', uuid)
      .executeTakeFirst();
    return row ? (JSON.parse(row.status) as CommandStatus) : null;
  }

  async recordAppliedCommand(userId: string, uuid: string, status: CommandStatus): Promise<void> {
    await this.db.insertInto('applied_commands')
      .values({ user_id: userId, uuid, status: JSON.stringify(status) })
      .execute();
  }

  async resolveTempId(userId: string, tempId: string): Promise<string | null> {
    const row = await this.db.selectFrom('temp_ids').select('real_id')
      .where('user_id', '=', userId).where('temp_id', '=', tempId)
      .executeTakeFirst();
    return row?.real_id ?? null;
  }

  async recordTempId(userId: string, tempId: string, realId: string): Promise<void> {
    await this.db.insertInto('temp_ids')
      .values({ user_id: userId, temp_id: tempId, real_id: realId })
      .onConflict((oc) => oc.columns(['user_id', 'temp_id']).doUpdateSet({ real_id: realId }))
      .execute();
  }

  /* ---------- Completion history ---------- */

  async addCompletion(userId: string, id: string, entry: CompletedItem): Promise<void> {
    await this.db.insertInto('completions')
      .values({
        user_id: userId, id, item_id: entry.id,
        completed_at: entry.completed_at, data: JSON.stringify(entry),
      })
      .execute();
  }

  async removeLatestCompletion(userId: string, itemId: string): Promise<void> {
    const latest = await this.db.selectFrom('completions').select('id')
      .where('user_id', '=', userId).where('item_id', '=', itemId)
      .orderBy('completed_at', 'desc')
      .executeTakeFirst();
    if (!latest) return;
    await this.db.deleteFrom('completions')
      .where('user_id', '=', userId).where('id', '=', latest.id)
      .execute();
  }

  /** Completions in [from, to), newest first. Both bounds are ISO timestamps. */
  async listCompletions(
    userId: string, from: string, to: string, offset: number, limit: number,
  ): Promise<CompletedItem[]> {
    const rows = await this.db.selectFrom('completions').select('data')
      .where('user_id', '=', userId)
      .where('completed_at', '>=', from).where('completed_at', '<', to)
      .orderBy('completed_at', 'desc').orderBy('id')
      .limit(limit).offset(offset)
      .execute();
    return rows.map((row) => JSON.parse(row.data) as CompletedItem);
  }
}

function toUser(row: { id: string; rev: number; user_rev: number; data: string }): UserRecord {
  return {
    id: row.id,
    rev: Number(row.rev),
    userRev: Number(row.user_rev),
    data: JSON.parse(row.data) as TodoistUser,
  };
}
