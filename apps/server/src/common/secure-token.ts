import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** 32 bytes = 256 bits of CSPRNG entropy, base64url encoded (43 chars). */
export const SECURE_TOKEN_BYTES = 32;

export function generateSecureToken(bytes = SECURE_TOKEN_BYTES): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Constant-time check that sha256(rawToken) equals the stored hex digest.
 * Both sides are fixed-length SHA-256 digests, so timingSafeEqual never
 * throws on length mismatch for well-formed input; malformed stored values
 * simply return false.
 */
export function tokenMatchesHash(rawToken: string | undefined | null, storedHashHex: string | null | undefined): boolean {
  if (!rawToken || !storedHashHex) return false;
  // Cap input length so an attacker cannot make us hash megabytes.
  if (rawToken.length > 256) return false;
  const provided = createHash('sha256').update(rawToken, 'utf8').digest();
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHashHex, 'hex');
  } catch {
    return false;
  }
  if (stored.length !== provided.length) return false;
  return timingSafeEqual(provided, stored);
}
