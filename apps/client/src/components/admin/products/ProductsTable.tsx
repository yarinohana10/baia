'use client';

import { useTranslations } from 'next-intl';
import { ProductRow } from './ProductRow';
import type { AdminProduct } from './types';

const COLUMNS = ['image', 'name', 'category', 'price', 'variants', 'stock', 'status'] as const;
const TH = 'px-5 py-3.5 font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]';

type Props = {
  products: AdminProduct[];
  onToggleFeatured: (product: AdminProduct) => void;
  onToggleActive: (product: AdminProduct) => void;
  onDelete: (id: string) => void;
};

export function ProductsTable({ products, ...actions }: Props) {
  const t = useTranslations('admin.products');
  return (
    <div className="overflow-x-auto rounded-xl border border-[#eeeeee] bg-white shadow-sm">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-[#eeeeee] bg-[#f3f3f4]">
            {COLUMNS.map((column) => (
              <th key={column} className={`${TH} text-start`}>
                {t(column)}
              </th>
            ))}
            <th className={`${TH} text-end`}>{t('actions')}</th>
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
            products.map((product) => <ProductRow key={product.id} product={product} {...actions} />)
          )}
        </tbody>
      </table>
    </div>
  );
}
