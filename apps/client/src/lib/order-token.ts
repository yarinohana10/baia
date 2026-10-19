/**
 * Guest order access: the token travels in the URL fragment (never sent to
 * servers or in Referer headers) and is exchanged once for an httpOnly cookie
 * scoped to /v1/orders/:id (see the server's order-access.ts).
 */

// Held in memory only until the exchange succeeds (survives StrictMode's
// double effect run, which would otherwise see the already-stripped hash).
const tokenInFlight = new Map<string, string>();

/** Reads `#token=...` and removes it from the address bar (and history). */
export function takeOrderToken(orderId: string): string | null {
  if (typeof window === 'undefined') return null;
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (token) {
    tokenInFlight.set(orderId, token);
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
  return tokenInFlight.get(orderId) ?? null;
}

/** Call once the token was exchanged for the cookie (or the exchange failed). */
export function releaseOrderToken(orderId: string) {
  tokenInFlight.delete(orderId);
}
