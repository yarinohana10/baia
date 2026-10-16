'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { isAxiosError } from 'axios';
import { api } from '@/lib/api';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { Link } from '@/i18n/navigation';
import { Plus, Pencil, Trash2, Eye, EyeOff, Star, Search, X } from 'lucide-react';

type ProductVariant = {
  id: string;
  stockQuantity: number;
  isActive: boolean;
  /** false = unlimited stock; stockQuantity is ignored. */
  trackInventory?: boolean;
};

type Product = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  basePrice: string;
  isActive: boolean;
  isFeatured: boolean;
  category: { nameEn: string; nameHe: string };
  images: { url: string }[];
  variants: ProductVariant[];
  _count: { variants: number };
};

const LOW_STOCK_THRESHOLD = 5;

type StockSummary = {
  status: 'no_sizes' | 'in_stock' | 'low_stock' | 'out_of_stock';
  /** Active sizes. */
  sizes: number;
  /** Total of tracked active sizes. */
  tracked: number;
  /** Active sizes that are tracked. */
  trackedCount: number;
  /** Active sizes with unlimited stock. */
  unlimitedCount: number;
};

function getStockSummary(variants: ProductVariant[]): StockSummary {
  const active = variants.filter((v) => v.isActive);
  const trackedVariants = active.filter((v) => v.trackInventory !== false);
  const unlimitedCount = active.length - trackedVariants.length;
  const tracked = trackedVariants.reduce((sum, v) => sum + v.stockQuantity, 0);
  const base = { sizes: active.length, tracked, trackedCount: trackedVariants.length, unlimitedCount };

  if (active.length === 0) return { ...base, status: 'no_sizes' };
  // Any unlimited size means the product can always be bought.
  if (unlimitedCount === 0 && tracked === 0) return { ...base, status: 'out_of_stock' };
  if (trackedVariants.some((v) => v.stockQuantity <= LOW_STOCK_THRESHOLD && v.stockQuantity > 0)) {
    return { ...base, status: 'low_stock' };
  }
  return { ...base, status: 'in_stock' };
}

type Notice = { kind: 'success' | 'info' | 'error'; text: string } | null;

export default function ProductsPage() {
  const t = useTranslations('admin.products');
  const locale = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const fetchProducts = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const res = await api.get('/admin/products', { params: { search: debouncedSearch || undefined } });
        if (!isCancelled()) setProducts(res.data);
      } catch {
        if (!isCancelled()) setNotice({ kind: 'error', text: t('loadFailed') });
      }
    },
    [debouncedSearch, t],
  );

  useEffect(() => {
    let cancelled = false;
    fetchProducts(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchProducts]);

  const serverMessage = (err: unknown) => {
    const message: unknown = isAxiosError(err) ? err.response?.data?.message : undefined;
    return typeof message === 'string' && message ? ` (${message})` : '';
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      const res = await api.delete(`/admin/products/${id}`);
      setNotice(
        res.data?.archived
          ? { kind: 'info', text: t('archivedNotice') }
          : { kind: 'success', text: t('deleted') },
      );
      await revalidateCatalog();
    } catch (err) {
      setNotice({ kind: 'error', text: t('deleteFailed') + serverMessage(err) });
    }
    fetchProducts();
  };

  const updateProduct = async (product: Product, data: Partial<Pick<Product, 'isActive' | 'isFeatured'>>) => {
    try {
      await api.put(`/admin/products/${product.id}`, data);
      await revalidateCatalog();
    } catch (err) {
      setNotice({ kind: 'error', text: t('updateFailed') + serverMessage(err) });
    }
    fetchProducts();
  };

  const toggleActive = (product: Product) => updateProduct(product, { isActive: !product.isActive });
  const toggleFeatured = (product: Product) => updateProduct(product, { isFeatured: !product.isFeatured });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[32px] leading-tight text-[#1a1c1c]">{t('title')}</h1>
          <p className="mt-1 font-body text-sm text-[#3f484c]">{t('subtitle')}</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 rounded-full bg-[#565555] px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-[#1a1c1c]"
        >
          <Plus size={16} /> {t('addProduct')}
        </Link>
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`mb-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3 font-body text-sm ${
            notice.kind === 'error'
              ? 'bg-red-50 text-red-700'
              : notice.kind === 'info'
              ? 'bg-amber-50 text-amber-800'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded p-1 opacity-70 hover:opacity-100"
            aria-label={t('dismiss')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[#3f484c]"
        />
        <input
          type="text"
          id="product-search"
          aria-label={t('searchPlaceholder')}
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-full bg-[#eeeeee] py-2.5 ps-10 pe-4 font-body text-sm text-[#1a1c1c] placeholder:text-[#3f484c]/60 focus:outline-none focus:ring-2 focus:ring-[#005d72]/20"
        />
      </div>

      {/* Product table */}
      <div className="overflow-x-auto rounded-xl border border-[#eeeeee] bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-[#eeeeee] bg-[#f3f3f4]">
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                {t('image')}
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                {t('name')}
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                {t('category')}
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                {t('price')}
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                {t('variants')}
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                {t('stock')}
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                {t('status')}
              </th>
              <th className="px-5 py-3.5 text-end font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center font-body text-sm text-[#3f484c]">
                  {t('noProducts')}
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const productName = locale === 'he' ? product.nameHe : product.nameEn;
                const secondaryName = locale === 'he' ? product.nameEn : product.nameHe;
                const stock = getStockSummary(product.variants);

                return (
                <tr
                  key={product.id}
                  className="border-b border-[#f3f3f4] transition-colors last:border-0 hover:bg-[#f9f9f9]"
                >
                  <td className="px-5 py-4">
                    {product.images[0] ? (
                      <Image
                        src={product.images[0].url}
                        alt={productName}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-lg bg-[#f3f3f4] object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-[#f3f3f4]" />
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {product.isFeatured && (
                        <Star
                          size={14}
                          className="shrink-0 fill-[#005d72] text-[#005d72]"
                        />
                      )}
                      <div>
                        <div className="font-body font-medium text-[#1a1c1c]">{productName}</div>
                        <div className="font-body text-xs text-[#3f484c]">{secondaryName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-body text-[#3f484c]">{locale === 'he' ? product.category.nameHe : product.category.nameEn}</td>
                  <td className="px-5 py-4 font-body font-medium text-[#1a1c1c]">
                    ₪{parseFloat(product.basePrice).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 font-body text-[#3f484c]">{stock.sizes}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-body text-xs font-medium ${
                          stock.status === 'no_sizes'
                            ? 'bg-[#f3f3f4] text-[#3f484c]'
                            : stock.status === 'out_of_stock'
                            ? 'bg-red-50 text-red-600'
                            : stock.status === 'low_stock'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {stock.status === 'no_sizes'
                          ? t('noSizes')
                          : stock.status === 'out_of_stock'
                          ? t('outOfStockBadge')
                          : stock.status === 'low_stock'
                          ? t('lowStockBadge')
                          : t('inStock')}
                      </span>
                      {stock.sizes > 0 && (
                        <span className="whitespace-nowrap font-body text-xs text-[#3f484c]">
                          {stock.trackedCount === 0 ? (
                            t('unlimited')
                          ) : (
                            <>
                              {stock.tracked}
                              {stock.unlimitedCount > 0 && (
                                <span className="ms-1 text-[11px] text-[#3f484c]/70">{t('plusUnlimited')}</span>
                              )}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 font-body text-xs font-medium ${
                        product.isActive
                          ? 'bg-[#e7e2d9] text-[#005d72]'
                          : 'bg-[#f3f3f4] text-[#3f484c]'
                      }`}
                    >
                      {product.isActive ? t('active') : t('inactive')}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => toggleFeatured(product)}
                        className={`rounded-lg p-2 transition-colors ${
                          product.isFeatured
                            ? 'text-[#005d72] hover:bg-[#e7e2d9]'
                            : 'text-[#bec8cd] hover:bg-[#f3f3f4] hover:text-[#005d72]'
                        }`}
                        aria-label={product.isFeatured ? t('removeFeatured') : t('markFeatured')}
                      >
                        <Star size={16} fill={product.isFeatured ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(product)}
                        className="rounded-lg p-2 text-[#3f484c] transition-colors hover:bg-[#f3f3f4] hover:text-[#005d72]"
                        aria-label={product.isActive ? t('deactivate') : t('activate')}
                      >
                        {product.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="rounded-lg p-2 text-[#3f484c] transition-colors hover:bg-[#f3f3f4] hover:text-[#005d72]"
                        aria-label={t('editProduct', { name: productName })}
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        className="rounded-lg p-2 text-[#3f484c] transition-colors hover:bg-red-50 hover:text-[#ba1a1a]"
                        aria-label={t('deleteProduct', { name: productName })}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
