import { createHash, randomBytes, randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A 16-character id in the same style as Todoist's v1 ids. */
export function newId(): string {
  let id = '';
  for (let i = 0; i < 16; i++) id += ALPHABET[randomInt(ALPHABET.length)];
  return id;
}

/** 43 url-safe characters, which the app's token check accepts. */
export const newToken = (): string => randomBytes(32).toString('base64url');

/** Only the hash is stored, so a copy of the database does not hand out logins. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
