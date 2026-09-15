import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing with scrypt from Node itself.
 *
 * Stored as `scrypt$N$r$p$salt$hash` (salt and hash in base64url), so the cost
 * can be raised later without breaking passwords hashed before.
 */

const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
/** scrypt needs about 128 * N * r bytes; the default cap is too low for N = 2^15. */
const MAX_MEMORY = 64 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 10;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, length, { N: n, r, p, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, N, R, P, KEY_LENGTH);
  return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p), expected.length);
  return timingSafeEqual(actual, expected);
}

/** A password the operator can hand over once: 20 url-safe characters. */
export const generatePassword = (): string => randomBytes(15).toString('base64url');
