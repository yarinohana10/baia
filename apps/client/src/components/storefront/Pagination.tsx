import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { listingHref, type ListingQuery } from '@/lib/catalog/query';

export function Pagination({
  basePath,
  query,
  totalPages,
}: {
  basePath: string;
  query: ListingQuery;
  totalPages: number;
}) {
  const t = useTranslations('storefront.category');
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const base = 'inline-flex h-9 min-w-9 items-center justify-center px-3 text-sm border rounded-lg transition-colors';

  return (
    <nav aria-label={t('pagination')} className="mt-12 flex justify-center">
      <ul className="flex flex-wrap items-center gap-2">
        {query.page > 1 && (
          <li>
            <Link href={listingHref(basePath, { ...query, page: query.page - 1 })} rel="prev" className={`${base} border-gray-300 hover:border-ocean-500`}>
              {t('previous')}
            </Link>
          </li>
        )}
        {pages.map((p) => (
          <li key={p}>
            <Link
              href={listingHref(basePath, { ...query, page: p })}
              aria-label={t('page', { page: p })}
              aria-current={p === query.page ? 'page' : undefined}
              className={`${base} ${p === query.page ? 'border-ocean-700 bg-ocean-700 text-white' : 'border-gray-300 hover:border-ocean-500'}`}
            >
              {p}
            </Link>
          </li>
        ))}
        {query.page < totalPages && (
          <li>
            <Link href={listingHref(basePath, { ...query, page: query.page + 1 })} rel="next" className={`${base} border-gray-300 hover:border-ocean-500`}>
              {t('next')}
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
