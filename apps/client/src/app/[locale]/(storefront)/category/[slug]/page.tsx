import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ListingHeader } from '@/components/storefront/ListingHeader';
import { EmptyCategory } from '@/components/storefront/EmptyCategory';
import { ListingResults } from '@/components/storefront/listing/ListingResults';
import { SubcategoryNav } from '@/components/storefront/listing/SubcategoryNav';
import { suggestedCollections } from '@/lib/catalog/collections';
import { JsonLd } from '@/components/storefront/JsonLd';
import { getCategories, getCategory, getFacets, getProducts } from '@/lib/catalog/server';
import { PAGE_SIZE, activeFilterCount, parseListingQuery } from '@/lib/catalog/query';
import { categoryLinks, localizedName } from '@/lib/catalog/names';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import type { Category } from '@/lib/catalog/types';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const query = parseListingQuery(await searchParams);
  const category = await getCategory(slug);
  if (!category) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  const name = localizedName(category, locale);
  const meta = pageMetadata({
    locale,
    path: `/category/${slug}`,
    title: name,
    description: t('categoryDescription', { name }),
    images: category.image ? [{ url: category.image, alt: name }] : undefined,
  });
  // Filtered/sorted/paginated variants consolidate onto the clean category URL.
  if (query.type || query.sort !== 'newest' || query.page > 1 || activeFilterCount(query) > 0) {
    meta.robots = { index: false, follow: true };
  }
  return meta;
}

type Crumb = { label: string; href: string };

/** Home > parent category (if any) > this category (at `href`). */
function categoryCrumbs(category: Category, href: string, parent: Category | undefined, locale: string, homeLabel: string): Crumb[] {
  return [
    { label: homeLabel, href: '/' },
    ...(parent ? [{ label: localizedName(parent, locale), href: `/category/${parent.slug}` }] : []),
    { label: localizedName(category, locale), href },
  ];
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const query = parseListingQuery(await searchParams);

  const [category, allCategories, t, tSeo] = await Promise.all([
    getCategory(slug),
    getCategories(),
    getTranslations('storefront'),
    getTranslations('storefront.category'),
  ]);
  if (!category) notFound();

  const children = category.children ?? [];
  const activeChild = query.type ? children.find((c) => c.slug === query.type) : undefined;
  const scopeId = activeChild?.id ?? category.id;
  const [{ products, total, totalPages }, facets] = await Promise.all([
    getProducts({ categoryId: scopeId, page: query.page, limit: PAGE_SIZE, sort: query.sort, filters: query }),
    getFacets({ categoryId: scopeId }),
  ]);

  const name = localizedName(category, locale);
  const parent = category.parentId ? allCategories.find((c) => c.id === category.parentId) : undefined;
  const basePath = `/category/${slug}`;
  const crumbs = categoryCrumbs(category, basePath, parent, locale, t('home'));
  const topLevel = categoryLinks(allCategories, locale);
  const suggestions = [
    ...suggestedCollections(topLevel, parent ? `/category/${parent.slug}` : basePath),
    { label: t('newArrivals.title'), href: '/new-arrivals' },
  ];
  const countLabel = tSeo('count', { count: total });
  const showSubcategories = children.length > 0 && (total > 0 || !!activeChild || activeFilterCount(query) > 0);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: absoluteUrl(locale, c.href) })))} />

      <div className="container-page py-8">
        <ListingHeader title={name} countLabel={countLabel} />

        {showSubcategories && (
          <SubcategoryNav
            basePath={basePath}
            query={query}
            items={children}
            activeId={activeChild?.id}
            locale={locale}
            label={tSeo('filterLabel')}
            allLabel={tSeo('all')}
          />
        )}

        <ListingResults
          basePath={basePath}
          query={query}
          facets={facets}
          products={products}
          total={total}
          totalPages={totalPages}
          countLabel={countLabel}
          empty={<EmptyCategory name={localizedName(activeChild ?? category, locale)} suggestions={suggestions} />}
        />
      </div>
    </>
  );
}
