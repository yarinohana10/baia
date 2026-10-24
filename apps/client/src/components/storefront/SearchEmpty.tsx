import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { NavItem } from './Header';

/** Search page without results: either no query yet, or nothing matched it. */
export function SearchEmpty({ query, suggestions }: { query?: string; suggestions: NavItem[] }) {
  const t = useTranslations('storefront.search');

  return (
    <section
      aria-labelledby="search-empty-title"
      className="mx-auto max-w-2xl rounded-none border border-gray-100 bg-[#F7F7F7] px-6 py-12 text-center sm:px-12 sm:py-16"
    >
      <h2 id="search-empty-title" className="text-[22px] sm:text-2xl font-semibold text-gray-900 tracking-tight">
        {query ? t('emptyTitle', { query }) : t('promptTitle')}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500">
        {query ? t('emptyBody') : t('promptBody')}
      </p>

      {suggestions.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-4 text-xs font-medium tracking-widest uppercase text-neutral-700">{t('browse')}</h3>
          <ul className="flex flex-wrap justify-center gap-2.5">
            {suggestions.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="inline-flex px-4 py-1.5 text-sm border border-gray-300 rounded-none transition-colors hover:border-neutral-600"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
