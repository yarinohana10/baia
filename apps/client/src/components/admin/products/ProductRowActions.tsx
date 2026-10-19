'use client';

import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Pencil, Star, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AdminProduct } from './types';

/** Featured / visibility toggles, edit link and delete for one product row. */
export function ProductRowActions({
  product,
  productName,
  onToggleFeatured,
  onToggleActive,
  onDelete,
}: {
  product: AdminProduct;
  productName: string;
  onToggleFeatured: (product: AdminProduct) => void;
  onToggleActive: (product: AdminProduct) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations('admin.products');
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onToggleFeatured(product)}
        className={`rounded-lg p-2 transition-colors ${
          product.isFeatured ? 'text-[#005d72] hover:bg-[#e7e2d9]' : 'text-[#bec8cd] hover:bg-[#f3f3f4] hover:text-[#005d72]'
        }`}
        aria-label={product.isFeatured ? t('removeFeatured') : t('markFeatured')}
      >
        <Star size={16} fill={product.isFeatured ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        onClick={() => onToggleActive(product)}
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
        onClick={() => onDelete(product.id)}
        className="rounded-lg p-2 text-[#3f484c] transition-colors hover:bg-red-50 hover:text-[#ba1a1a]"
        aria-label={t('deleteProduct', { name: productName })}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
