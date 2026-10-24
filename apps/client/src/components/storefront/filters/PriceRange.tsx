'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/catalog/pricing';
import { priceInputValue, priceRangeFromInputs } from '@/lib/catalog/filter-options';
import type { Facets } from '@/lib/catalog/types';
import { PriceInput } from './PriceInput';

type Props = {
  facets: Facets;
  min?: number;
  max?: number;
  onApply: (min: number | undefined, max: number | undefined) => void;
};

/**
 * Price filter: "from" / "to" inputs applied together. Mount it with a `key` of
 * the applied range so the inputs reset when the URL changes.
 */
export function PriceRange({ facets, min, max, onApply }: Props) {
  const t = useTranslations('filters');
  const [from, setFrom] = useState(() => priceInputValue(min));
  const [to, setTo] = useState(() => priceInputValue(max));
  const floor = facets.price.min !== null ? Math.floor(facets.price.min) : undefined;
  const ceil = facets.price.max !== null ? Math.ceil(facets.price.max) : undefined;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const range = priceRangeFromInputs(from, to);
    onApply(range.min, range.max);
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="flex items-end gap-3">
        <PriceInput label={t('from')} ariaLabel={t('minPrice')} value={from} placeholder={floor} onChange={setFrom} />
        <span aria-hidden="true" className="pb-2.5 text-gray-400">–</span>
        <PriceInput label={t('to')} ariaLabel={t('maxPrice')} value={to} placeholder={ceil} onChange={setTo} />
      </div>
      {floor !== undefined && ceil !== undefined && (
        <p className="mt-2 text-xs text-gray-500">
          {t('priceRange', { min: formatPrice(floor), max: formatPrice(ceil) })}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="submit" className="h-9 flex-1 rounded-none bg-black text-sm font-medium text-white hover:bg-neutral-800">
          {t('apply')}
        </button>
        {(min !== undefined || max !== undefined) && (
          <button
            type="button"
            onClick={() => onApply(undefined, undefined)}
            className="h-9 rounded-none border border-gray-300 px-3 text-sm text-charcoal"
          >
            {t('clear')}
          </button>
        )}
      </div>
    </form>
  );
}
