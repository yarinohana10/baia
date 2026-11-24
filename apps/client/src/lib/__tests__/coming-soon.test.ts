import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { comingSoonEnabled, isAdminRequest, isOpenPath, resetComingSoonCache } from '../coming-soon';

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

describe('coming soon gate', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    resetComingSoonCache();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps sign-in, admin and the page itself reachable, and gates the store', () => {
    for (const p of ['/login', '/register', '/verify-email', '/reset-password/x', '/admin', '/admin/products', '/coming-soon']) {
      expect(isOpenPath(p)).toBe(true);
    }
    for (const p of ['/', '/category/women', '/product/x', '/checkout', '/cart', '/administrator']) {
      expect(isOpenPath(p)).toBe(false);
    }
  });

  it('reads the flag from the site config and caches it briefly', async () => {
    fetchMock.mockResolvedValue(json({ comingSoon: true }));
    expect(await comingSoonEnabled(1_000)).toBe(true);
    expect(await comingSoonEnabled(5_000)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(json({ comingSoon: false }));
    expect(await comingSoonEnabled(20_000)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the last known value when the API fails, and starts open', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    expect(await comingSoonEnabled(1_000)).toBe(false);

    resetComingSoonCache();
    fetchMock.mockResolvedValueOnce(json({ comingSoon: true })).mockResolvedValueOnce(json(null, false));
    expect(await comingSoonEnabled(1_000)).toBe(true);
    expect(await comingSoonEnabled(20_000)).toBe(true);
  });

  it('treats only an ADMIN session as an admin', async () => {
    expect(await isAdminRequest(null)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(json({ user: { role: 'ADMIN' } }));
    expect(await isAdminRequest('baia.session_token=a')).toBe(true);
    fetchMock.mockResolvedValueOnce(json({ user: { role: 'CUSTOMER' } }));
    expect(await isAdminRequest('baia.session_token=b')).toBe(false);
    fetchMock.mockResolvedValueOnce(json(null));
    expect(await isAdminRequest('baia.session_token=c')).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect(await isAdminRequest('baia.session_token=d')).toBe(false);
  });
});
