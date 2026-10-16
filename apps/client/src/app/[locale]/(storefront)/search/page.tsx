import { SlidersHorizontal } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ListingHeader } from '@/components/storefront/ListingHeader';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { SortSelect } from '@/components/storefront/SortSelect';
import { Pagination } from '@/components/storefront/Pagination';
import { SearchEmpty } from '@/components/storefront/SearchEmpty';
import { SearchForm } from '@/components/storefront/SearchForm';
import { getCategories, getProducts, toCardProduct } from '@/lib/catalog/server';
import { PAGE_SIZE, parseListingQuery } from '@/lib/catalog/query';
import { pageMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { q } = parseListingQuery(await searchParams);
  const t = await getTranslations({ locale, namespace: 'seo' });
  // Search result pages are thin, user-generated URLs: never index them.
  return pageMetadata({
    locale,
    path: '/search',
    title: q ? t('searchResultsTitle', { query: q }) : t('searchTitle'),
    description: t('searchDescription'),
    noIndex: true,
  });
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = parseListingQuery(await searchParams);
  const basePath = '/search';

  const [{ products, total, totalPages }, categories, t, tCat] = await Promise.all([
    query.q
      ? getProducts({ search: query.q, page: query.page, limit: PAGE_SIZE, sort: query.sort })
      : Promise.resolve({ products: [], total: 0, totalPages: 0 }),
    getCategories(),
    getTranslations('storefront.search'),
    getTranslations('storefront.category'),
  ]);

  const suggestions = [
    ...categories.map((c) => ({ label: locale === 'he' ? c.nameHe : c.nameEn, href: `/category/${c.slug}` })),
    { label: t('newArrivals'), href: '/new-arrivals' },
  ];

  return (
    <div className="container-page py-8">
      <SearchForm key={query.q ?? ''} defaultValue={query.q} autoFocus={!query.q} className="mb-8 max-w-xl" />

      {query.q && (
        <ListingHeader title={t('resultsFor', { query: query.q })} countLabel={tCat('count', { count: total })} />
      )}

      {products.length === 0 ? (
        <SearchEmpty query={query.q} suggestions={suggestions} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>{tCat('count', { count: total })}</span>
            </div>
            {total > 1 && <SortSelect basePath={basePath} query={query} />}
          </div>
          <ProductGrid products={products.map(toCardProduct)} priorityCount={4} />
          <Pagination basePath={basePath} query={query} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
