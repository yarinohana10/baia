import { generateSecureToken, sha256Hex, tokenMatchesHash } from '../src/common/secure-token';
import {
  canAccessOrder,
  isValidOrderToken,
  orderTokenExpiry,
  signOrderToken,
  signedTokenExpiry,
} from '../src/orders/order-access';

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

describe('signed order links', () => {
  const order = { id: 'order-1', userId: null, accessTokenHash: null, accessTokenExpiresAt: null };

  it('grants access to exactly one order until it expires', () => {
    const token = signOrderToken('order-1', new Date(Date.now() + 60_000));
    expect(token).toMatch(/^v1_[0-9a-z]+_[A-Za-z0-9_-]{43}$/);
    expect(isValidOrderToken(order, token)).toBe(true);
    expect(isValidOrderToken({ ...order, id: 'order-2' }, token)).toBe(false);
    expect(orderTokenExpiry(order, token)).toBeInstanceOf(Date);
  });

  it('rejects expired, tampered and malformed tokens', () => {
    const expired = signOrderToken('order-1', new Date(Date.now() - 1000));
    expect(signedTokenExpiry('order-1', expired)).toBeNull();
    const token = signOrderToken('order-1', new Date(Date.now() + 60_000));
    const [, exp, mac] = /^v1_([0-9a-z]+)_(.+)$/.exec(token)!;
    const later = (parseInt(exp, 36) + 3600).toString(36);
    expect(isValidOrderToken(order, `v1_${later}_${mac}`)).toBe(false);
    expect(isValidOrderToken(order, 'v1_')).toBe(false);
    expect(isValidOrderToken(order, 'v1_abc_')).toBe(false);
    expect(isValidOrderToken(order, `v1_${exp}_${'A'.repeat(43)}`)).toBe(false);
  });
});
