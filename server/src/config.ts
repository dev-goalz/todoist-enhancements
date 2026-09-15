export interface Config {
  port: number;
  host: string;
  /** SQLite file. */
  dbPath: string;
  corsOrigin?: string;
  staticDir?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '127.0.0.1',
    dbPath: env.DB_PATH ?? 'data/tasks.db',
    corsOrigin: env.CORS_ORIGIN || undefined,
    staticDir: env.STATIC_DIR || undefined,
  };
}
