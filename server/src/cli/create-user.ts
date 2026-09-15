import { parseArgs } from 'node:util';
import { loadConfig } from '../config';
import { migrate, openDatabase } from '../db';
import { MIN_PASSWORD_LENGTH } from '../passwords';
import { Repo } from '../repo';
import { createUser } from '../users';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    timezone: { type: 'string', default: Intl.DateTimeFormat().resolvedOptions().timeZone },
    'start-day': { type: 'string', default: '1' },
    lang: { type: 'string', default: 'en' },
    password: { type: 'string' },
  },
});

if (!values.email || !values.name) {
  console.error(
    'Usage: npm run create-user -- --email <email> --name <full name> '
    + '[--timezone <IANA zone>] [--start-day 1-7] [--lang en] [--password <password>]',
  );
  process.exit(1);
}

if (values.password !== undefined && values.password.length < MIN_PASSWORD_LENGTH) {
  console.error(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}

const config = loadConfig(process.env);
const db = openDatabase(config.database);
await migrate(db);

if (await new Repo(db).findUserByEmail(values.email)) {
  console.error(`An account with the email ${values.email} already exists.`);
  await db.destroy();
  process.exit(1);
}

const { user, token } = await createUser(new Repo(db), {
  email: values.email,
  fullName: values.name,
  timezone: values.timezone,
  startDay: Number(values['start-day']),
  lang: values.lang,
  password: values.password,
});
await db.destroy();

console.log(`Created ${user.email} (${user.id}) in the database.`);
console.log(`API token, shown once: ${token}`);
