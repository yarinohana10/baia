'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import ProductCard from '@/components/storefront/ProductCard';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';

type Category = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  children?: Category[];
};

type Product = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  basePrice: string;
  images: { url: string; color?: string }[];
  variants: {
    salePrice?: string | null;
    saleStart?: string | null;
    saleEnd?: string | null;
    priceOverride?: string | null;
  }[];
};

type SortOption = 'newest' | 'price-asc' | 'price-desc';

export default function CategoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const locale = useLocale();
  const t = useTranslations('product');
  const tCommon = useTranslations('common');

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<SortOption>('newest');
  const [loading, setLoading] = useState(true);
  const [selectedSubCat, setSelectedSubCat] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/categories/${slug}`).then((res) => setCategory(res.data));
  }, [slug]);

  useEffect(() => {
    if (!category) return;
    setLoading(true);

    const categoryId = selectedSubCat || category.id;
    api
      .get('/products', {
        params: { categoryId, page, limit: 12, sort },
      })
      .then((res) => {
        setProducts(res.data.products || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      })
      .finally(() => setLoading(false));
  }, [category, selectedSubCat, page, sort]);

  const catName = category
    ? locale === 'he'
      ? category.nameHe
      : category.nameEn
    : '';

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-light tracking-[0.2em] uppercase mb-2">{catName}</h1>
        <p className="text-sm text-gray-400">
          {total} {total === 1 ? 'product' : 'products'}
        </p>
      </div>

      {/* Sub-categories */}
      {category?.children && category.children.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => { setSelectedSubCat(null); setPage(1); }}
            className={`px-4 py-1.5 text-sm border transition-colors ${
              !selectedSubCat
                ? 'border-ocean-700 bg-ocean-700 text-white'
                : 'border-gray-300 hover:border-ocean-500'
            }`}
          >
            All
          </button>
          {category.children.map((sub) => (
            <button
              key={sub.id}
              onClick={() => { setSelectedSubCat(sub.id); setPage(1); }}
              className={`px-4 py-1.5 text-sm border transition-colors ${
                selectedSubCat === sub.id
                  ? 'border-ocean-700 bg-ocean-700 text-white'
                  : 'border-gray-300 hover:border-ocean-500'
              }`}
            >
              {locale === 'he' ? sub.nameHe : sub.nameEn}
            </button>
          ))}
        </div>
      )}

      {/* Sort bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <SlidersHorizontal size={14} />
          <span>{total} results</span>
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
            className="appearance-none text-sm text-gray-600 bg-transparent pe-6 cursor-pointer focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
          <ChevronDown size={12} className="absolute end-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-gray-200 mb-3" />
              <div className="h-4 bg-gray-200 w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400 tracking-wider">
          No products in this category yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-9 h-9 text-sm border transition-colors ${
                    page === i + 1
                      ? 'border-ocean-700 bg-ocean-700 text-white'
                      : 'border-gray-300 hover:border-ocean-500'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
