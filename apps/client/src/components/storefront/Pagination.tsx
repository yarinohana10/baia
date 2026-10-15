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
  const base = 'inline-flex h-10 min-w-10 items-center justify-center rounded-[2px] px-3 text-sm font-semibold';

  return (
    <nav aria-label={t('pagination')} className="mt-16 flex justify-center">
      <ul className="flex flex-wrap items-center gap-1.5">
        {query.page > 1 && (
          <li>
            <Link href={listingHref(basePath, { ...query, page: query.page - 1 })} rel="prev" className={`${base} text-ink hover:bg-sand-100`}>
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
              className={`${base} ${p === query.page ? 'bg-ink text-white' : 'text-ink hover:bg-sand-100'}`}
            >
              {p}
            </Link>
          </li>
        ))}
        {query.page < totalPages && (
          <li>
            <Link href={listingHref(basePath, { ...query, page: query.page + 1 })} rel="next" className={`${base} text-ink hover:bg-sand-100`}>
              {t('next')}
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
