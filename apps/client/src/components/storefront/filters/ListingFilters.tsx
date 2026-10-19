'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { SortSelect } from '@/components/storefront/SortSelect';
import { formatPrice, swatchColor } from '@/lib/catalog/pricing';
import {
  activeFilterCount,
  clearFilters,
  listingHref,
  toggleValue,
  withFilters,
  type ListingFilters as Filters,
  type ListingQuery,
} from '@/lib/catalog/query';
import type { Facets } from '@/lib/catalog/types';

type Props = {
  basePath: string;
  query: ListingQuery;
  facets: Facets;
  total: number;
  /** Shown next to the sort control (e.g. "24 products"). */
  countLabel: string;
};

/** URL-driven filter state: every change is a navigation (shareable, back-button friendly). */
function useFilterNavigation(basePath: string, query: ListingQuery) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (next: ListingQuery) =>
    startTransition(() => router.push(listingHref(basePath, next), { scroll: false }));
  return {
    pending,
    apply: (patch: Partial<Filters>) => go(withFilters(query, patch)),
    clearAll: () => go(clearFilters(query)),
  };
}

/**
 * Listing filters for category / new-arrivals / search pages.
 * Desktop: a toolbar of dropdowns (size, color, price, in stock) + sort.
 * Phones: a "Filter" button opening a side sheet with the same controls.
 * Active filters show as removable chips with "Clear all".
 */
export function ListingFilters({ basePath, query, facets, total, countLabel }: Props) {
  const t = useTranslations('filters');
  const locale = useLocale();
  const { pending, apply, clearAll } = useFilterNavigation(basePath, query);
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = activeFilterCount(query);

  const hasSizes = facets.sizes.length > 0 || !!query.sizes?.length;
  const hasColors = facets.colors.length > 0 || !!query.colors?.length;
  const hasPrice = facets.price.min !== null && facets.price.max !== null && facets.price.max > facets.price.min;

  const sizeLabel = query.sizes?.length ? `${t('size')} (${query.sizes.length})` : t('size');
  const colorLabel = query.colors?.length ? `${t('color')} (${query.colors.length})` : t('color');
  const priceActive = query.minPrice !== undefined || query.maxPrice !== undefined;

  const sections = {
    sizes: <SizeOptions facets={facets} selected={query.sizes} onToggle={(s) => apply({ sizes: toggleValue(query.sizes, s) })} />,
    colors: (
      <ColorOptions facets={facets} selected={query.colors} onToggle={(c) => apply({ colors: toggleValue(query.colors, c) })} />
    ),
    price: (
      <PriceRange
        key={`${query.minPrice ?? ''}-${query.maxPrice ?? ''}`}
        facets={facets}
        min={query.minPrice}
        max={query.maxPrice}
        onApply={(minPrice, maxPrice) => apply({ minPrice, maxPrice })}
      />
    ),
    inStock: <InStockToggle checked={!!query.inStock} onChange={(v) => apply({ inStock: v || undefined })} />,
  };

  return (
    <div className="mb-6" aria-busy={pending}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-4">
        {/* Phones: one button opening the sheet */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-charcoal md:hidden"
          aria-haspopup="dialog"
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          {t('open')}
          {active > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-ocean-700 text-[11px] text-white">
              {active}
            </span>
          )}
        </button>

        {/* Desktop: dropdown per filter */}
        <div className="hidden flex-wrap items-center gap-2 md:flex" role="group" aria-label={t('label')}>
          {hasSizes && (
            <FilterPopover label={sizeLabel} active={!!query.sizes?.length} title={t('size')}>
              {sections.sizes}
            </FilterPopover>
          )}
          {hasColors && (
            <FilterPopover label={colorLabel} active={!!query.colors?.length} title={t('color')}>
              {sections.colors}
            </FilterPopover>
          )}
          {(hasPrice || priceActive) && (
            <FilterPopover label={t('price')} active={priceActive} title={t('price')}>
              {sections.price}
            </FilterPopover>
          )}
          <div className="ms-1">{sections.inStock}</div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span aria-live="polite" className="hidden sm:inline">
            {pending ? t('updating') : countLabel}
          </span>
          {total > 1 && <SortSelect basePath={basePath} query={query} />}
        </div>
      </div>

      {active > 0 && <ActiveChips query={query} onApply={apply} onClearAll={clearAll} locale={locale} />}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side={locale === 'he' ? 'right' : 'left'}
          showCloseButton={false}
          className="w-[88%] gap-0 bg-white p-0 sm:max-w-sm"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <SheetTitle className="text-base font-semibold text-charcoal">{t('title')}</SheetTitle>
            <SheetClose
              aria-label={t('close')}
              className="flex size-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              <X size={18} aria-hidden="true" />
            </SheetClose>
          </div>
          <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
            {hasSizes && <SheetSection title={t('size')}>{sections.sizes}</SheetSection>}
            {hasColors && <SheetSection title={t('color')}>{sections.colors}</SheetSection>}
            {(hasPrice || priceActive) && <SheetSection title={t('price')}>{sections.price}</SheetSection>}
            <SheetSection title={t('availability')}>{sections.inStock}</SheetSection>
          </div>
          <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
            {active > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-charcoal"
              >
                {t('clearAll')}
              </button>
            )}
            <SheetClose className="h-11 flex-1 rounded-lg bg-ocean-700 text-sm font-semibold text-white disabled:opacity-70" disabled={pending}>
              {pending ? t('updating') : t('showResults', { count: total })}
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-charcoal">{title}</h3>
      {children}
    </section>
  );
}

function FilterPopover({ label, title, active, children }: { label: string; title: string; active: boolean; children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600 data-popup-open:border-ocean-700',
          active ? 'border-ocean-700 bg-ocean-50 text-ocean-800' : 'border-gray-300 text-charcoal hover:border-ocean-500',
        )}
      >
        {label}
        <ChevronDown size={14} aria-hidden="true" className="text-gray-500" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup className="w-80 rounded-xl border border-gray-200 bg-white p-5 shadow-xl outline-none transition-[opacity,transform] duration-150 data-starting-style:-translate-y-1 data-starting-style:opacity-0 data-ending-style:opacity-0">
            <Popover.Title className="sr-only">{title}</Popover.Title>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SizeOptions({
  facets,
  selected = [],
  onToggle,
}: {
  facets: Facets;
  selected?: string[];
  onToggle: (size: string) => void;
}) {
  const t = useTranslations('filters');
  // Keep selected sizes visible even if they just sold out, so they can be removed.
  const values = [...facets.sizes.map((s) => s.value), ...selected.filter((s) => !facets.sizes.some((f) => f.value === s))];
  if (values.length === 0) return <p className="text-sm text-gray-500">{t('noOptions')}</p>;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {values.map((size) => {
          const on = selected.includes(size);
          return (
            <button
              key={size}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(size)}
              className={cn(
                'h-10 min-w-11 rounded-lg border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600',
                on ? 'border-ocean-700 bg-ocean-700 text-white' : 'border-gray-300 text-charcoal hover:border-ocean-600',
              )}
            >
              <span dir="ltr">{size}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">{t('sizeHint')}</p>
    </div>
  );
}

function ColorOptions({
  facets,
  selected = [],
  onToggle,
}: {
  facets: Facets;
  selected?: string[];
  onToggle: (color: string) => void;
}) {
  const t = useTranslations('filters');
  const options = [
    ...facets.colors,
    ...selected.filter((c) => !facets.colors.some((f) => f.value === c)).map((value) => ({ value, count: 0 })),
  ];
  if (options.length === 0) return <p className="text-sm text-gray-500">{t('noOptions')}</p>;
  return (
    <ul className="grid grid-cols-2 gap-1">
      {options.map(({ value, count }) => {
        const on = selected.includes(value);
        const swatch = swatchColor(value);
        return (
          <li key={value}>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(value)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start text-sm text-charcoal hover:bg-warm-100 focus-visible:outline-2 focus-visible:outline-ocean-600"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'relative flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-gray-300',
                  on && 'ring-2 ring-ocean-700 ring-offset-1',
                  !swatch && 'bg-[conic-gradient(#e56b5a,#e8c33f,#3f6e4e,#2b5c9e,#6a4a8c,#e56b5a)]',
                )}
                style={swatch ? { backgroundColor: swatch } : undefined}
              >
                {on && <Check size={12} className={swatch && isLight(swatch) ? 'text-charcoal' : 'text-white'} />}
              </span>
              <span className="min-w-0 flex-1 truncate">{value}</span>
              {count > 0 && <span className="text-xs text-gray-400 tabular-nums">{count}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
}

function PriceRange({
  facets,
  min,
  max,
  onApply,
}: {
  facets: Facets;
  min?: number;
  max?: number;
  onApply: (min: number | undefined, max: number | undefined) => void;
}) {
  const t = useTranslations('filters');
  const [from, setFrom] = useState(min !== undefined ? String(min) : '');
  const [to, setTo] = useState(max !== undefined ? String(max) : '');
  const floor = facets.price.min !== null ? Math.floor(facets.price.min) : undefined;
  const ceil = facets.price.max !== null ? Math.ceil(facets.price.max) : undefined;

  const parse = (v: string) => {
    const n = Number(v);
    return v.trim() === '' || !Number.isFinite(n) || n < 0 ? undefined : Math.round(n);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        let lo = parse(from);
        let hi = parse(to);
        if (lo !== undefined && hi !== undefined && lo > hi) [lo, hi] = [hi, lo];
        onApply(lo, hi);
      }}
    >
      <div className="flex items-end gap-3">
        <label className="flex-1 text-xs text-gray-600">
          {t('from')}
          <span className="mt-1 flex h-10 items-center rounded-lg border border-gray-300 px-2.5 focus-within:border-ocean-600">
            <span aria-hidden="true" className="text-gray-400">₪</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={from}
              placeholder={floor !== undefined ? String(floor) : ''}
              onChange={(e) => setFrom(e.target.value)}
              aria-label={t('minPrice')}
              className="w-full bg-transparent px-1 text-sm text-charcoal outline-none"
            />
          </span>
        </label>
        <span aria-hidden="true" className="pb-2.5 text-gray-400">–</span>
        <label className="flex-1 text-xs text-gray-600">
          {t('to')}
          <span className="mt-1 flex h-10 items-center rounded-lg border border-gray-300 px-2.5 focus-within:border-ocean-600">
            <span aria-hidden="true" className="text-gray-400">₪</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={to}
              placeholder={ceil !== undefined ? String(ceil) : ''}
              onChange={(e) => setTo(e.target.value)}
              aria-label={t('maxPrice')}
              className="w-full bg-transparent px-1 text-sm text-charcoal outline-none"
            />
          </span>
        </label>
      </div>
      {floor !== undefined && ceil !== undefined && (
        <p className="mt-2 text-xs text-gray-500">
          {t('priceRange', { min: formatPrice(floor), max: formatPrice(ceil) })}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="submit" className="h-9 flex-1 rounded-lg bg-ocean-700 text-sm font-medium text-white hover:bg-ocean-800">
          {t('apply')}
        </button>
        {(min !== undefined || max !== undefined) && (
          <button
            type="button"
            onClick={() => onApply(undefined, undefined)}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm text-charcoal"
          >
            {t('clear')}
          </button>
        )}
      </div>
    </form>
  );
}

function InStockToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const t = useTranslations('filters');
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-charcoal">
      <span className="relative inline-flex">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="h-6 w-10 rounded-full bg-gray-300 transition-colors peer-checked:bg-ocean-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ocean-600"
        />
        <span
          aria-hidden="true"
          className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ltr:peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4"
        />
      </span>
      {t('inStock')}
    </label>
  );
}

function ActiveChips({
  query,
  onApply,
  onClearAll,
  locale,
}: {
  query: ListingQuery;
  onApply: (patch: Partial<Filters>) => void;
  onClearAll: () => void;
  locale: string;
}) {
  const t = useTranslations('filters');
  const chips: { key: string; label: string; remove: () => void }[] = [];
  query.sizes?.forEach((s) =>
    chips.push({ key: `s-${s}`, label: `${t('size')}: ${s}`, remove: () => onApply({ sizes: toggleValue(query.sizes, s) }) }),
  );
  query.colors?.forEach((c) =>
    chips.push({ key: `c-${c}`, label: `${t('color')}: ${c}`, remove: () => onApply({ colors: toggleValue(query.colors, c) }) }),
  );
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const min = query.minPrice !== undefined ? formatPrice(query.minPrice) : undefined;
    const max = query.maxPrice !== undefined ? formatPrice(query.maxPrice) : undefined;
    const label = min && max ? t('priceBetween', { min, max }) : min ? t('priceFrom', { min }) : t('priceUpTo', { max: max! });
    chips.push({ key: 'price', label, remove: () => onApply({ minPrice: undefined, maxPrice: undefined }) });
  }
  if (query.inStock) chips.push({ key: 'stock', label: t('inStock'), remove: () => onApply({ inStock: undefined }) });

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={t('active')} role="group" lang={locale}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          aria-label={t('remove', { label: chip.label })}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ocean-50 px-3 text-[13px] text-ocean-800 hover:bg-ocean-100 focus-visible:outline-2 focus-visible:outline-ocean-600"
        >
          {chip.label}
          <X size={13} aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ms-1 text-[13px] text-gray-600 underline underline-offset-4 hover:text-ocean-700"
      >
        {t('clearAll')}
      </button>
    </div>
  );
}
