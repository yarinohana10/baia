import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ListingHeader } from '@/components/storefront/ListingHeader';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { ListingFilters } from '@/components/storefront/filters/ListingFilters';
import { FilteredEmpty } from '@/components/storefront/filters/FilteredEmpty';
import { Pagination } from '@/components/storefront/Pagination';
import { SearchEmpty } from '@/components/storefront/SearchEmpty';
import { SearchForm } from '@/components/storefront/SearchForm';
import { getCategories, getFacets, getProducts, toCardProduct } from '@/lib/catalog/server';
import { PAGE_SIZE, activeFilterCount, clearFilters, listingHref, parseListingQuery } from '@/lib/catalog/query';
import type { Facets } from '@/lib/catalog/types';
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

  const noFacets: Facets = { sizes: [], colors: [], price: { min: null, max: null } };
  const [{ products, total, totalPages }, facets, categories, t, tCat] = await Promise.all([
    query.q
      ? getProducts({ search: query.q, page: query.page, limit: PAGE_SIZE, sort: query.sort, filters: query })
      : Promise.resolve({ products: [], total: 0, totalPages: 0 }),
    query.q ? getFacets({ search: query.q }) : Promise.resolve(noFacets),
    getCategories(),
    getTranslations('storefront.search'),
    getTranslations('storefront.category'),
  ]);

  const filtered = activeFilterCount(query) > 0;
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

      {products.length === 0 && !(filtered && query.q) ? (
        <SearchEmpty query={query.q} suggestions={suggestions} />
      ) : (
        <>
          <ListingFilters
            basePath={basePath}
            query={query}
            facets={facets}
            total={total}
            countLabel={tCat('count', { count: total })}
          />
          {products.length === 0 ? (
            <FilteredEmpty clearHref={listingHref(basePath, clearFilters(query))} />
          ) : (
            <>
              <ProductGrid products={products.map(toCardProduct)} priorityCount={4} />
              <Pagination basePath={basePath} query={query} totalPages={totalPages} />
            </>
          )}
        </>
      )}
    </div>
  );
}
