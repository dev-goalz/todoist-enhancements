export interface Config {
  port: number;
  host: string;
  /** A SQLite file path, or a postgres:// URL. */
  database: string;
  corsOrigin?: string;
  staticDir?: string;
  allowSignup: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '127.0.0.1',
    database: env.DATABASE_URL || env.DB_PATH || 'data/tasks.db',
    corsOrigin: env.CORS_ORIGIN || undefined,
    staticDir: env.STATIC_DIR || undefined,
    allowSignup: env.ALLOW_SIGNUP !== 'false',
  };
}
