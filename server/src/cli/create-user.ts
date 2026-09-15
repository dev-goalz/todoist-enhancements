import { parseArgs } from 'node:util';
import { loadConfig } from '../config';
import { migrate, openSqlite } from '../db';
import { Repo } from '../repo';
import { createUser } from '../users';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    timezone: { type: 'string', default: Intl.DateTimeFormat().resolvedOptions().timeZone },
    'start-day': { type: 'string', default: '1' },
    lang: { type: 'string', default: 'en' },
  },
});

if (!values.email || !values.name) {
  console.error(
    'Usage: npm run create-user -- --email <email> --name <full name> '
    + '[--timezone <IANA zone>] [--start-day 1-7] [--lang en]',
  );
  process.exit(1);
}

const config = loadConfig(process.env);
const db = openSqlite(config.dbPath);
await migrate(db);

const { user, token } = await createUser(new Repo(db), {
  email: values.email,
  fullName: values.name,
  timezone: values.timezone,
  startDay: Number(values['start-day']),
  lang: values.lang,
});
await db.destroy();

console.log(`Created ${user.email} (${user.id}) in ${config.dbPath}.`);
console.log(`API token, shown once: ${token}`);
