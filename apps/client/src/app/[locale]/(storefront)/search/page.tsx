import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ListingHeader } from '@/components/storefront/ListingHeader';
import { ListingResults } from '@/components/storefront/listing/ListingResults';
import { SearchEmpty } from '@/components/storefront/SearchEmpty';
import { SearchForm } from '@/components/storefront/SearchForm';
import { getCategories, getFacets, getProducts } from '@/lib/catalog/server';
import { PAGE_SIZE, parseListingQuery } from '@/lib/catalog/query';
import { categoryLinks } from '@/lib/catalog/names';
import type { Facets } from '@/lib/catalog/types';
import { pageMetadata } from '@/lib/seo';

const NO_FACETS: Facets = { sizes: [], colors: [], price: { min: null, max: null } };

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

  const [{ products, total, totalPages }, facets, categories, t, tCat] = await Promise.all([
    query.q
      ? getProducts({ search: query.q, page: query.page, limit: PAGE_SIZE, sort: query.sort, filters: query })
      : Promise.resolve({ products: [], total: 0, totalPages: 0 }),
    query.q ? getFacets({ search: query.q }) : Promise.resolve(NO_FACETS),
    getCategories(),
    getTranslations('storefront.search'),
    getTranslations('storefront.category'),
  ]);

  const countLabel = tCat('count', { count: total });
  const empty = (
    <SearchEmpty
      query={query.q}
      suggestions={[...categoryLinks(categories, locale), { label: t('newArrivals'), href: '/new-arrivals' }]}
    />
  );

  return (
    <div className="container-page py-8">
      <SearchForm key={query.q ?? ''} defaultValue={query.q} autoFocus={!query.q} className="mb-8 max-w-xl" />

      {query.q ? (
        <>
          <ListingHeader title={t('resultsFor', { query: query.q })} countLabel={countLabel} />
          <ListingResults
            basePath={basePath}
            query={query}
            facets={facets}
            products={products}
            total={total}
            totalPages={totalPages}
            countLabel={countLabel}
            empty={empty}
          />
        </>
      ) : (
        empty
      )}
    </div>
  );
}
