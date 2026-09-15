import { hashToken, newToken } from './ids';
import { generatePassword, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './passwords';
import type { Repo } from './repo';
import { createUser, tzInfo } from './users';

/** Why an account request was refused. The code is what the app reads; the message is for people. */
export class AccountError extends Error {
  constructor(
    readonly code:
      | 'invalid_email' | 'invalid_name' | 'weak_password' | 'email_taken'
      | 'invalid_credentials' | 'signup_closed',
    message: string,
  ) {
    super(message);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignUpInput {
  fullName: unknown;
  email: unknown;
  password: unknown;
  timezone?: unknown;
  lang?: unknown;
}

function validTimezone(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'UTC';
  try {
    tzInfo(value);
    return value;
  } catch {
    return 'UTC';
  }
}

/** Creates an account with a password and signs it in, returning the device's token. */
export async function signUp(repo: Repo, input: SignUpInput): Promise<string> {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email)) throw new AccountError('invalid_email', 'Enter a valid email address.');
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  if (!fullName) throw new AccountError('invalid_name', 'Enter your name.');
  if (typeof input.password !== 'string' || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AccountError('weak_password', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (await repo.findUserByEmail(email)) {
    throw new AccountError('email_taken', 'An account with this email already exists.');
  }

  const lang = typeof input.lang === 'string' && /^[a-z]{2}$/.test(input.lang) ? input.lang : 'en';
  const { token } = await createUser(repo, {
    email,
    fullName,
    timezone: validTimezone(input.timezone),
    lang,
    password: input.password,
  });
  return token;
}

/** Checks email and password and hands out a new token for this device. */
export async function signIn(repo: Repo, email: unknown, password: unknown): Promise<string> {
  const refused = new AccountError('invalid_credentials', 'That email and password do not match.');
  if (typeof email !== 'string' || typeof password !== 'string') throw refused;

  const user = await repo.findUserByEmail(email);
  // The same answer for an unknown email and a wrong password, so the form
  // cannot be used to find out who has an account.
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) throw refused;

  const token = newToken();
  await repo.addToken(user.id, hashToken(token));
  return token;
}

/** Ends one device's session. */
export async function signOut(repo: Repo, token: string): Promise<void> {
  await repo.revokeToken(hashToken(token));
}

/**
 * Gives an account a new, generated password and signs it out everywhere.
 * Returns the password, or null when there is no such account.
 */
export async function resetPassword(repo: Repo, email: string): Promise<string | null> {
  const user = await repo.findUserByEmail(email);
  if (!user) return null;
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  await repo.transaction(async (trx) => {
    await trx.setPasswordHash(user.id, passwordHash);
    await trx.revokeAllTokens(user.id);
  });
  return password;
}
