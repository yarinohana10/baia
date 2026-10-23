'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { getStockSummary } from './stock-summary';
import { ProductStockCell } from './ProductStockCell';
import { ProductRowActions } from './ProductRowActions';
import type { AdminProduct } from './types';

/** Hidden beats Back Soon: a hidden product is not on the storefront at all. */
function visibilityOf(product: AdminProduct) {
  if (!product.isActive) return { label: 'hiddenStatus', className: 'bg-[#f3f3f4] text-[#3f484c]' } as const;
  if (product.backSoon) return { label: 'backSoonStatus', className: 'bg-amber-50 text-amber-700' } as const;
  return { label: 'active', className: 'bg-[#e7e2d9] text-[#005d72]' } as const;
}

type Props = {
  product: AdminProduct;
  lowStockThreshold: number;
  onToggleFeatured: (product: AdminProduct) => void;
  onToggleActive: (product: AdminProduct) => void;
  onToggleBackSoon: (product: AdminProduct) => void;
  onDelete: (id: string) => void;
};

export function ProductRow({ product, lowStockThreshold, onToggleFeatured, onToggleActive, onToggleBackSoon, onDelete }: Props) {
  const t = useTranslations('admin.products');
  const locale = useLocale();
  const productName = locale === 'he' ? product.nameHe : product.nameEn;
  const secondaryName = locale === 'he' ? product.nameEn : product.nameHe;
  const visibility = visibilityOf(product);
  const stock = getStockSummary(product.variants, lowStockThreshold);

  return (
    <tr className="border-b border-[#f3f3f4] transition-colors last:border-0 hover:bg-[#f9f9f9]">
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
          {product.isFeatured && <Star size={14} className="shrink-0 fill-[#005d72] text-[#005d72]" />}
          <div>
            <div className="font-body font-medium text-[#1a1c1c]">{productName}</div>
            <div className="font-body text-xs text-[#3f484c]">{secondaryName}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 font-body text-[#3f484c]">{locale === 'he' ? product.category.nameHe : product.category.nameEn}</td>
      <td className="px-5 py-4 font-body font-medium text-[#1a1c1c]">₪{parseFloat(product.basePrice).toFixed(2)}</td>
      <td className="px-5 py-4 font-body text-[#3f484c]">{stock.sizes}</td>
      <td className="px-5 py-4">
        <ProductStockCell stock={stock} />
      </td>
      <td className="px-5 py-4">
        <span className={`inline-flex rounded-full px-3 py-1 font-body text-xs font-medium ${visibility.className}`}>
          {t(visibility.label)}
        </span>
      </td>
      <td className="px-5 py-4">
        <ProductRowActions
          product={product}
          productName={productName}
          onToggleFeatured={onToggleFeatured}
          onToggleActive={onToggleActive}
          onToggleBackSoon={onToggleBackSoon}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}
