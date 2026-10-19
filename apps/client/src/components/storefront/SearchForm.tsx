'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { MAX_SEARCH_LENGTH, listingHref } from '@/lib/catalog/query';

/**
 * Product search box. Submits to /search?q= (client-side navigation, with a
 * plain GET form as the no-JS fallback). Empty submissions are ignored.
 */
export function SearchForm({
  defaultValue = '',
  autoFocus,
  onSubmitted,
  className = '',
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  onSubmitted?: () => void;
  className?: string;
}) {
  const t = useTranslations('storefront.search');
  const locale = useLocale();
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const inputId = useId();

  return (
    <form
      role="search"
      action={`/${locale}/search`}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.replace(/\s+/g, ' ').trim();
        if (!q) return;
        router.push(listingHref('/search', { q }));
        onSubmitted?.();
      }}
      className={`relative flex items-center ${className}`}
    >
      <label htmlFor={inputId} className="sr-only">
        {t('label')}
      </label>
      <Search size={18} strokeWidth={1.6} aria-hidden="true" className="pointer-events-none absolute start-4 text-ink/50" />
      <input
        id={inputId}
        name="q"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={MAX_SEARCH_LENGTH}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('placeholder')}
        className="h-12 w-full rounded-full border border-ink/20 bg-white ps-11 pe-24 text-[15px] text-ink placeholder:text-ink/45 focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          aria-label={t('clear')}
          className="absolute end-[4.75rem] inline-flex size-8 items-center justify-center rounded-full text-ink/50 hover:text-ink"
        >
          <X size={16} strokeWidth={1.6} />
        </button>
      )}
      <button
        type="submit"
        className="absolute end-1.5 h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-white transition-colors hover:bg-ink/85"
      >
        {t('submit')}
      </button>
    </form>
  );
}
