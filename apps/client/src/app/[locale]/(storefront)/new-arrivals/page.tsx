import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ListingHeader } from '@/components/storefront/ListingHeader';
import { EmptyCategory } from '@/components/storefront/EmptyCategory';
import { ListingResults } from '@/components/storefront/listing/ListingResults';
import { getCategories, getFacets, getProducts } from '@/lib/catalog/server';
import { PAGE_SIZE, activeFilterCount, parseListingQuery } from '@/lib/catalog/query';
import { categoryLinks } from '@/lib/catalog/names';
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
  const countLabel = tCat('count', { count: total });

  return (
    <div className="container-page py-8">
      <ListingHeader title={tSeo('newArrivalsTitle')} countLabel={countLabel} />
      <ListingResults
        basePath="/new-arrivals"
        query={query}
        facets={facets}
        products={products}
        total={total}
        totalPages={totalPages}
        countLabel={countLabel}
        empty={<EmptyCategory suggestions={categoryLinks(categories, locale)} />}
      />
    </div>
  );
}
