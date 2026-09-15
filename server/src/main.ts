import { buildApp } from './app';
import { loadConfig } from './config';
import { migrate, openSqlite } from './db';

const config = loadConfig(process.env);
const db = openSqlite(config.dbPath);
await migrate(db);

const app = await buildApp({
  db,
  corsOrigin: config.corsOrigin,
  staticDir: config.staticDir,
  logger: true,
});

const shutdown = async () => {
  await app.close();
  await db.destroy();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.port, host: config.host });
