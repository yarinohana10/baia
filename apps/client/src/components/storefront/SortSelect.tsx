'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { listingHref, SORT_OPTIONS, type ListingQuery } from '@/lib/catalog/query';

const LABEL_KEYS = { newest: 'sortNewest', 'price-asc': 'sortPriceAsc', 'price-desc': 'sortPriceDesc' } as const;

export function SortSelect({ basePath, query }: { basePath: string; query: ListingQuery }) {
  const t = useTranslations('storefront.category');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="relative inline-flex items-center text-sm">
      <span className="sr-only">{t('sortLabel')}</span>
      <span className="relative inline-flex">
        <select
          value={query.sort}
          aria-busy={pending}
          onChange={(e) =>
            startTransition(() =>
              router.push(listingHref(basePath, { ...query, sort: e.target.value as ListingQuery['sort'], page: 1 }), {
                scroll: false,
              }),
            )
          }
          className="appearance-none text-[12px] uppercase ltr:tracking-[0.12em] text-black bg-transparent pe-6 cursor-pointer focus:outline-none rounded-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {t(LABEL_KEYS[o])}
            </option>
          ))}
        </select>
        <ChevronDown size={12} aria-hidden="true" className="pointer-events-none absolute end-0 top-1/2 -translate-y-1/2 text-black" />
      </span>
    </label>
  );
}
