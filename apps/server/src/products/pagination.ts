/**
 * Lenient query-string integer: anything that isn't a finite integer (missing,
 * `abc`, `1.5e400`) falls back to `fallback`; the result is clamped to
 * [min, max]. Used for `page` / `limit` so bad input never causes a 500 or an
 * unbounded query.
 */
export function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  const value = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  return Math.min(max, Math.max(min, value));
}

export const PUBLIC_PAGE_LIMIT = { default: 20, max: 100 };
export const ADMIN_PAGE_LIMIT = { default: 50, max: 200 };
export const MAX_PAGE = 10_000;
