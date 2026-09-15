import { describe, expect, it } from 'vitest';
import { hashToken, newId, newToken } from '../src/ids';

describe('ids', () => {
  it('makes 16-character alphanumeric ids that do not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, newId));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{16}$/);
  });

  it('makes tokens the connect screen accepts', () => {
    // Same rule as looksLikeToken in src/api/auth.ts.
    expect(newToken()).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(newToken()).not.toBe(newToken());
  });

  it('hashes a token deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toHaveLength(64);
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});
