import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const revalidateTag = vi.fn();
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag, revalidatePath }));

const { POST } = await import('./route');
const { revalidateCatalog } = await import('@/lib/catalog/revalidate');

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/revalidate', { method: 'POST', headers });
}

function mockSession(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('POST /api/revalidate', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('rejects requests without a session cookie', async () => {
    const fetchMock = mockSession(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects non-admin sessions', async () => {
    mockSession({ user: { role: 'CUSTOMER' } });
    const res = await POST(req({ cookie: 'baia.session_token=x' }));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects cross-site requests', async () => {
    mockSession({ user: { role: 'ADMIN' } });
    const res = await POST(req({ cookie: 'baia.session_token=x', origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
  });

  it('forwards the cookie and revalidates the catalogue for admins', async () => {
    const fetchMock = mockSession({ user: { role: 'ADMIN' } });
    const res = await POST(req({ cookie: 'baia.session_token=x', origin: 'http://localhost:3000' }));
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/get-session');
    expect(fetchMock.mock.calls[0][1].headers.cookie).toBe('baia.session_token=x');
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual(['products', 'categories', 'site-config']);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
});

describe('revalidateCatalog', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(revalidateCatalog()).resolves.toBeUndefined();
  });
});
