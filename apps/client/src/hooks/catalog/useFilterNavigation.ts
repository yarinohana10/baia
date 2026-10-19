'use client';

import { useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { clearFilters, listingHref, withFilters, type ListingFilters, type ListingQuery } from '@/lib/catalog/query';

/** URL-driven filter state: every change is a navigation (shareable, back-button friendly). */
export function useFilterNavigation(basePath: string, query: ListingQuery) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (next: ListingQuery) =>
    startTransition(() => router.push(listingHref(basePath, next), { scroll: false }));
  return {
    pending,
    apply: (patch: Partial<ListingFilters>) => go(withFilters(query, patch)),
    clearAll: () => go(clearFilters(query)),
  };
}
