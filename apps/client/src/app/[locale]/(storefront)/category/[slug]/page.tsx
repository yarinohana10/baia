import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SlidersHorizontal } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ListingHeader } from '@/components/storefront/ListingHeader';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { SortSelect } from '@/components/storefront/SortSelect';
import { Pagination } from '@/components/storefront/Pagination';
import { EmptyCategory } from '@/components/storefront/EmptyCategory';
import { suggestedCollections } from '@/lib/catalog/collections';
import { JsonLd } from '@/components/storefront/JsonLd';
import { getCategories, getCategory, getProducts, toCardProduct } from '@/lib/catalog/server';
import { PAGE_SIZE, listingHref, parseListingQuery } from '@/lib/catalog/query';
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
  if (query.type || query.sort !== 'newest' || query.page > 1) {
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
  const { products, total, totalPages } = await getProducts({
    categoryId: activeChild?.id ?? category.id,
    page: query.page,
    limit: PAGE_SIZE,
    sort: query.sort,
  });

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
        {children.length > 0 && (total > 0 || activeChild) && (
          <nav aria-label={tSeo('filterLabel')} className="mb-8">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={listingHref(basePath, { sort: query.sort })}
                  aria-current={!activeChild ? 'page' : undefined}
                  className={`${pill} inline-block ${pillState(!activeChild)}`}
                >
                  {tSeo('all')}
                </Link>
              </li>
              {children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={listingHref(basePath, { type: child.slug, sort: query.sort })}
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

        {products.length === 0 ? (
          <EmptyCategory name={activeChild ? nameOf(activeChild, locale) : name} suggestions={suggestions} />
        ) : (
          <>
            {/* Sort bar */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <SlidersHorizontal size={14} aria-hidden="true" />
                <span>{tSeo('count', { count: total })}</span>
              </div>
              {total > 1 && <SortSelect basePath={basePath} query={query} />}
            </div>

            <ProductGrid products={products.map(toCardProduct)} priorityCount={4} />
            <Pagination basePath={basePath} query={query} totalPages={totalPages} />
          </>
        )}
      </div>
    </>
  );
}
