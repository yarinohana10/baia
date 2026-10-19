import { useTranslations } from 'next-intl';
import { SearchX } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/** Empty state when filters (not the category itself) leave no products. */
export function FilteredEmpty({ clearHref }: { clearHref: string }) {
  const t = useTranslations('filters');
  return (
    <div className="flex flex-col items-center rounded-2xl bg-warm-100 px-6 py-16 text-center">
      <SearchX size={32} strokeWidth={1.4} aria-hidden="true" className="mb-4 text-ocean-600" />
      <h2 className="mb-2 text-lg font-semibold text-charcoal">{t('noResultsTitle')}</h2>
      <p className="mb-6 text-sm text-gray-600">{t('noResultsHint')}</p>
      <Link
        href={clearHref}
        scroll={false}
        className="inline-flex h-10 items-center rounded-lg bg-ocean-700 px-5 text-sm font-medium text-white hover:bg-ocean-800"
      >
        {t('clearAll')}
      </Link>
    </div>
  );
}
