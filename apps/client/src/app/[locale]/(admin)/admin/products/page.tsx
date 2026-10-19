'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { Link } from '@/i18n/navigation';
import { useAdminList } from '@/hooks/admin/useAdminList';
import { useListQuery } from '@/hooks/admin/useListQuery';
import type { ListPage } from '@/hooks/admin/admin-list';
import { ProductsTable } from '@/components/admin/products/ProductsTable';
import { ProductsNoticeBanner } from '@/components/admin/products/ProductsNoticeBanner';
import { isNoSizesError, serverMessage } from '@/components/admin/products/product-errors';
import type { AdminProduct, ProductsNotice } from '@/components/admin/products/types';

const selectProducts = (data: AdminProduct[]): ListPage<AdminProduct> => ({
  items: data,
  total: data.length,
  totalPages: 1,
  meta: undefined,
});

export default function ProductsPage() {
  const t = useTranslations('admin.products');
  const [query, { setSearch }] = useListQuery(null);
  const list = useAdminList({
    url: '/admin/products',
    params: { search: query.appliedSearch || undefined },
    select: selectProducts,
  });
  const [notice, setNotice] = useState<ProductsNotice | null>(null);
  const shownNotice: ProductsNotice | null = list.error ? { kind: 'error', text: t('loadFailed') } : notice;

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      const res = await api.delete(`/admin/products/${id}`);
      setNotice(res.data?.archived ? { kind: 'info', text: t('archivedNotice') } : { kind: 'success', text: t('deleted') });
      await revalidateCatalog();
    } catch (err) {
      setNotice({ kind: 'error', text: t('deleteFailed') + serverMessage(err) });
    }
    list.reload();
  };

  const updateProduct = async (product: AdminProduct, data: Partial<Pick<AdminProduct, 'isActive' | 'isFeatured'>>) => {
    try {
      await api.put(`/admin/products/${product.id}`, data);
      await revalidateCatalog();
    } catch (err) {
      setNotice({ kind: 'error', text: isNoSizesError(err) ? t('activateNoSizes') : t('updateFailed') + serverMessage(err) });
    }
    list.reload();
  };

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

      {shownNotice && (
        <ProductsNoticeBanner
          notice={shownNotice}
          onDismiss={() => {
            setNotice(null);
            list.dismissError();
          }}
          dismissLabel={t('dismiss')}
        />
      )}

      <div className="relative mb-6 max-w-md">
        <Search size={16} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[#3f484c]" />
        <input
          type="text"
          id="product-search"
          aria-label={t('searchPlaceholder')}
          placeholder={t('searchPlaceholder')}
          value={query.search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-full bg-[#eeeeee] py-2.5 ps-10 pe-4 font-body text-sm text-[#1a1c1c] placeholder:text-[#3f484c]/60 focus:outline-none focus:ring-2 focus:ring-[#005d72]/20"
        />
      </div>

      <ProductsTable
        products={list.items}
        onToggleFeatured={(product) => updateProduct(product, { isFeatured: !product.isFeatured })}
        onToggleActive={(product) => updateProduct(product, { isActive: !product.isActive })}
        onDelete={handleDelete}
      />
    </div>
  );
}
