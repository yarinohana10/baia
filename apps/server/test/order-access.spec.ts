import { generateSecureToken, sha256Hex, tokenMatchesHash } from '../src/common/secure-token';
import { canAccessOrder, isValidOrderToken } from '../src/orders/order-access';

describe('secure tokens', () => {
  it('generates 256-bit base64url tokens that do not repeat', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('matches only the exact token against its stored hash', () => {
    const token = generateSecureToken();
    const hash = sha256Hex(token);
    expect(tokenMatchesHash(token, hash)).toBe(true);
    expect(tokenMatchesHash(token + 'x', hash)).toBe(false);
    expect(tokenMatchesHash('', hash)).toBe(false);
    expect(tokenMatchesHash(token, null)).toBe(false);
    expect(tokenMatchesHash(token, 'not-hex')).toBe(false);
    expect(tokenMatchesHash('a'.repeat(10_000), hash)).toBe(false);
  });
});

describe('order access policy', () => {
  const token = generateSecureToken();
  const future = new Date(Date.now() + 60_000);
  const guestOrder = { id: 'o1', userId: null, accessTokenHash: sha256Hex(token), accessTokenExpiresAt: future };
  const userOrder = { id: 'o2', userId: 'u1', accessTokenHash: null, accessTokenExpiresAt: null };

  it('owner can access; other users cannot', () => {
    expect(canAccessOrder(userOrder, { user: { id: 'u1', email: 'a' } }, { allowAdmin: true })).toBe(true);
    expect(canAccessOrder(userOrder, { user: { id: 'u2', email: 'b' } }, { allowAdmin: true })).toBe(false);
  });

  it('admin access is opt-in per endpoint', () => {
    const admin = { id: 'adm', email: 'x', role: 'ADMIN' };
    expect(canAccessOrder(userOrder, { user: admin }, { allowAdmin: true })).toBe(true);
    expect(canAccessOrder(userOrder, { user: admin }, { allowAdmin: false })).toBe(false);
  });

  it('guest token must match and be unexpired', () => {
    expect(isValidOrderToken(guestOrder, token)).toBe(true);
    expect(isValidOrderToken(guestOrder, generateSecureToken())).toBe(false);
    expect(isValidOrderToken(guestOrder, undefined)).toBe(false);
    expect(isValidOrderToken({ ...guestOrder, accessTokenExpiresAt: new Date(Date.now() - 1) }, token)).toBe(false);
  });

  it('a user with no matching ownership is not granted access to a guest order by being logged in', () => {
    expect(canAccessOrder(guestOrder, { user: { id: 'u1', email: 'a' } }, { allowAdmin: true })).toBe(false);
  });
});
