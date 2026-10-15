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
    <label className="inline-flex items-center gap-2 self-start text-sm sm:self-auto">
      <span className="text-stone">{t('sortLabel')}</span>
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
          className="cursor-pointer appearance-none rounded-[2px] border border-sand-300 bg-white py-2 ps-3 pe-8 font-semibold text-ink"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {t(LABEL_KEYS[o])}
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-stone" />
      </span>
    </label>
  );
}
