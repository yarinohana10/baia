import { SlidersHorizontal } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ListingHeader } from '@/components/storefront/ListingHeader';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { SortSelect } from '@/components/storefront/SortSelect';
import { Pagination } from '@/components/storefront/Pagination';
import { EmptyCategory } from '@/components/storefront/EmptyCategory';
import { getCategories, getProducts, toCardProduct } from '@/lib/catalog/server';
import { PAGE_SIZE, parseListingQuery } from '@/lib/catalog/query';
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
  if (query.sort !== 'newest' || query.page > 1) meta.robots = { index: false, follow: true };
  return meta;
}

export default async function NewArrivalsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = parseListingQuery(await searchParams);

  const [{ products, total, totalPages }, categories, t, tCat, tSeo] = await Promise.all([
    getProducts({ page: query.page, limit: PAGE_SIZE, sort: query.sort }),
    getCategories(),
    getTranslations('storefront'),
    getTranslations('storefront.category'),
    getTranslations('seo'),
  ]);
  const basePath = '/new-arrivals';

  return (
    <div className="container-page py-8">
      <ListingHeader title={tSeo('newArrivalsTitle')} countLabel={tCat('count', { count: total })} />
      {products.length === 0 ? (
        <EmptyCategory
          suggestions={categories.map((c) => ({
            label: locale === 'he' ? c.nameHe : c.nameEn,
            href: `/category/${c.slug}`,
          }))}
        />
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
