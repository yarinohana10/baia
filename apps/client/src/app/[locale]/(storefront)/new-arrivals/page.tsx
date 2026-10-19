import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ListingHeader } from '@/components/storefront/ListingHeader';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { ListingFilters } from '@/components/storefront/filters/ListingFilters';
import { FilteredEmpty } from '@/components/storefront/filters/FilteredEmpty';
import { Pagination } from '@/components/storefront/Pagination';
import { EmptyCategory } from '@/components/storefront/EmptyCategory';
import { getCategories, getFacets, getProducts, toCardProduct } from '@/lib/catalog/server';
import { PAGE_SIZE, activeFilterCount, clearFilters, listingHref, parseListingQuery } from '@/lib/catalog/query';
import { pageMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const query = parseListingQuery(await searchParams);
  const t = await getTranslations({ locale, namespace: 'seo' });
  const meta = pageMetadata({
    locale,
    path: '/new-arrivals',
    title: t('newArrivalsTitle'),
    description: t('newArrivalsDescription'),
  });
  if (query.sort !== 'newest' || query.page > 1 || activeFilterCount(query) > 0) meta.robots = { index: false, follow: true };
  return meta;
}

export default async function NewArrivalsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = parseListingQuery(await searchParams);

  const [{ products, total, totalPages }, facets, categories, tCat, tSeo] = await Promise.all([
    getProducts({ page: query.page, limit: PAGE_SIZE, sort: query.sort, filters: query }),
    getFacets(),
    getCategories(),
    getTranslations('storefront.category'),
    getTranslations('seo'),
  ]);
  const basePath = '/new-arrivals';
  const filtered = activeFilterCount(query) > 0;

  return (
    <div className="container-page py-8">
      <ListingHeader title={tSeo('newArrivalsTitle')} countLabel={tCat('count', { count: total })} />
      {products.length === 0 && !filtered ? (
        <EmptyCategory
          suggestions={categories.map((c) => ({
            label: locale === 'he' ? c.nameHe : c.nameEn,
            href: `/category/${c.slug}`,
          }))}
        />
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
