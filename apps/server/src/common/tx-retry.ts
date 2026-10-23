/** Postgres deadlock / serialization failures, as surfaced by Prisma (P2034) or the raw driver (40P01 / 40001). */
export function isRetryableTxError(err: unknown): boolean {
  const e = err as { code?: string; meta?: { code?: string }; message?: string } | null;
  if (!e) return false;
  if (e.code === 'P2034') return true;
  if (e.meta?.code === '40P01' || e.meta?.code === '40001') return true;
  return /deadlock detected|could not serialize access/i.test(e.message ?? '');
}

/**
 * Runs a whole transaction again (once by default) when Postgres aborted it
 * as a deadlock victim. The callback must open its own transaction, so a
 * retry starts from a clean slate.
 */
export async function withTxRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryableTxError(err)) throw err;
    }
  }
}
