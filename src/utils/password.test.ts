import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isHashedPassword, sha256Hex } from './password';

describe('password hashing and verification', () => {
  it('hashes password with a random salt in salt:hash format', () => {
    const hash1 = hashPassword('mySecretPass123');
    const hash2 = hashPassword('mySecretPass123');

    expect(hash1).toMatch(/^[0-9a-f]{16}:[0-9a-f]{64}$/i);
    expect(hash2).toMatch(/^[0-9a-f]{16}:[0-9a-f]{64}$/i);
    // Two hashes of the same password must differ due to unique salts
    expect(hash1).not.toBe(hash2);
  });

  it('correctly verifies passwords with salted hash', () => {
    const hash = hashPassword('admin123');
    expect(verifyPassword('admin123', hash)).toBe(true);
    expect(verifyPassword('wrong123', hash)).toBe(false);
    expect(verifyPassword('', hash)).toBe(false);
  });

  it('backward-compatible with legacy unsalted 64-character SHA-256 hash', () => {
    const legacyHash = sha256Hex('admin');
    expect(legacyHash).toHaveLength(64);
    expect(isHashedPassword(legacyHash)).toBe(true);
    expect(verifyPassword('admin', legacyHash)).toBe(true);
    expect(verifyPassword('wrong', legacyHash)).toBe(false);
  });

  it('backward-compatible with legacy plaintext passwords', () => {
    expect(isHashedPassword('plaintextPass')).toBe(false);
    expect(verifyPassword('plaintextPass', 'plaintextPass')).toBe(true);
    expect(verifyPassword('wrongPass', 'plaintextPass')).toBe(false);
  });

  it('rejects empty or undefined stored password', () => {
    expect(verifyPassword('anything', undefined)).toBe(false);
    expect(verifyPassword('anything', '')).toBe(false);
  });
});
