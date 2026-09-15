import { parseArgs } from 'node:util';
import { resetPassword } from '../accounts';
import { loadConfig } from '../config';
import { migrate, openDatabase } from '../db';
import { Repo } from '../repo';

const { values } = parseArgs({ options: { email: { type: 'string' } } });

if (!values.email) {
  console.error('Usage: npm run reset-password -- --email <email>');
  process.exit(1);
}

const config = loadConfig(process.env);
const db = openDatabase(config.database);
await migrate(db);
const password = await resetPassword(new Repo(db), values.email);
await db.destroy();

if (password === null) {
  console.error(`No account with the email ${values.email}.`);
  process.exit(1);
}
console.log(`New password for ${values.email}, shown once: ${password}`);
console.log('The account has been signed out on every device.');
