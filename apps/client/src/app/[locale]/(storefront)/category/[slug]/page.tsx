import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ListingHeader } from '@/components/storefront/ListingHeader';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { ListingFilters } from '@/components/storefront/filters/ListingFilters';
import { FilteredEmpty } from '@/components/storefront/filters/FilteredEmpty';
import { Pagination } from '@/components/storefront/Pagination';
import { EmptyCategory } from '@/components/storefront/EmptyCategory';
import { suggestedCollections } from '@/lib/catalog/collections';
import { JsonLd } from '@/components/storefront/JsonLd';
import { getCategories, getCategory, getFacets, getProducts, toCardProduct } from '@/lib/catalog/server';
import { PAGE_SIZE, activeFilterCount, clearFilters, listingHref, parseListingQuery } from '@/lib/catalog/query';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import type { Category } from '@/lib/catalog/types';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const nameOf = (c: { nameHe: string; nameEn: string }, locale: string) => (locale === 'he' ? c.nameHe : c.nameEn);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const query = parseListingQuery(await searchParams);
  const category = await getCategory(slug);
  if (!category) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  const name = nameOf(category, locale);
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
  const filtered = activeFilterCount(query) > 0;

  const name = nameOf(category, locale);
  const parent: Category | undefined = category.parentId
    ? allCategories.find((c) => c.id === category.parentId)
    : undefined;
  const basePath = `/category/${slug}`;

  const crumbs = [
    { label: t('home'), href: '/' },
    ...(parent ? [{ label: nameOf(parent, locale), href: `/category/${parent.slug}` }] : []),
    { label: name, href: basePath },
  ];

  const topLevel = allCategories.map((c) => ({ label: nameOf(c, locale), href: `/category/${c.slug}` }));
  const suggestions = [
    ...suggestedCollections(topLevel, parent ? `/category/${parent.slug}` : basePath),
    { label: t('newArrivals.title'), href: '/new-arrivals' },
  ];

  const pill = 'px-4 py-1.5 text-sm border rounded-lg transition-colors';
  const pillState = (active: boolean) =>
    active ? 'border-ocean-700 bg-ocean-700 text-white' : 'border-gray-300 hover:border-ocean-500';

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          crumbs.map((c) => ({ name: c.label, url: absoluteUrl(locale, c.href === '/' ? '/' : c.href) })),
        )}
      />

      <div className="container-page py-8">
        <ListingHeader title={name} countLabel={tSeo('count', { count: total })} />

        {/* Sub-categories */}
        {children.length > 0 && (total > 0 || activeChild || filtered) && (
          <nav aria-label={tSeo('filterLabel')} className="mb-8">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={listingHref(basePath, { ...clearFilters(query), type: undefined })}
                  aria-current={!activeChild ? 'page' : undefined}
                  className={`${pill} inline-block ${pillState(!activeChild)}`}
                >
                  {tSeo('all')}
                </Link>
              </li>
              {children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={listingHref(basePath, { ...clearFilters(query), type: child.slug })}
                    aria-current={activeChild?.id === child.id ? 'page' : undefined}
                    className={`${pill} inline-block ${pillState(activeChild?.id === child.id)}`}
                  >
                    {nameOf(child, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {products.length === 0 && !filtered ? (
          <EmptyCategory name={activeChild ? nameOf(activeChild, locale) : name} suggestions={suggestions} />
        ) : (
          <>
            <ListingFilters
              basePath={basePath}
              query={query}
              facets={facets}
              total={total}
              countLabel={tSeo('count', { count: total })}
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
    </>
  );
}
