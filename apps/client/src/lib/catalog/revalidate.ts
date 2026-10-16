/**
 * Tells the storefront to drop its cached catalogue after an admin mutation
 * (product, category, order/stock or settings change). Call it after the API
 * call succeeds. Best-effort: it never throws, and the cache still expires on
 * its own after a few minutes if this fails.
 */
export async function revalidateCatalog(): Promise<void> {
  try {
    await fetch('/api/revalidate', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
  } catch {
    // Ignore: revalidation is an optimisation, not part of the mutation.
  }
}
