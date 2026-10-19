import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { CATALOG_TAGS } from '@/lib/catalog/server';
import { forwardedRequestHeaders, isSameOriginRequest, serverAuthUrl } from '@/lib/api-urls';

export const dynamic = 'force-dynamic';

/** Asks the API who owns the forwarded session cookie; only admins may purge the cache. */
async function isAdmin(incoming: Headers): Promise<boolean> {
  if (!incoming.get('cookie')) return false;
  try {
    const res = await fetch(`${serverAuthUrl()}/api/auth/get-session?disableCookieCache=true`, {
      headers: forwardedRequestHeaders(incoming),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const session = (await res.json()) as { user?: { role?: string } } | null;
    return session?.user?.role === 'ADMIN';
  } catch {
    return false;
  }
}

/**
 * Purges the storefront's cached catalogue (products, categories, site
 * config) after an admin change. Requires a valid admin session cookie.
 */
export async function POST(request: NextRequest) {
  // Cookie-authenticated POST: refuse cross-site callers.
  // (request.nextUrl.origin is the container's bind address behind a proxy
  // in standalone mode, so compare against the Host the browser used.)
  const origin = request.headers.get('origin');
  if (origin && !isSameOriginRequest(origin, request.headers, request.nextUrl.origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!(await isAdmin(request.headers))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  for (const tag of CATALOG_TAGS) revalidateTag(tag);
  // Also drop the ISR pages (home, category, product, shipping, sitemap).
  revalidatePath('/', 'layout');

  return NextResponse.json({ revalidated: true, tags: CATALOG_TAGS });
}
