'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { StockRowField } from './StockRowField';
import type { Variant } from './stock-variants';

type Props = {
  variant: Variant;
  rowKey: string;
  basePrice: string;
  errorFor: (field: string) => string | undefined;
  onPatch: (changes: Partial<Variant>) => void;
};

const dateValue = (iso: string | null) => (iso ? iso.split('T')[0] : '');

/** SKU, price override and sale fields of one size. */
export function StockRowDetails({ variant: v, rowKey, basePrice, errorFor, onPatch }: Props) {
  const t = useTranslations('admin.productForm');
  return (
    <>
      <StockRowField id={`sku-${rowKey}`} label={t('sku')} error={errorFor('sku')}>
        <Input
          id={`sku-${rowKey}`}
          dir="ltr"
          value={v.sku}
          onChange={(e) => onPatch({ sku: e.target.value, autoSku: false })}
          aria-invalid={!!errorFor('sku')}
        />
      </StockRowField>
      <StockRowField id={`price-${rowKey}`} label={t('priceOverride')} error={errorFor('priceOverride')}>
        <Input
          id={`price-${rowKey}`}
          type="number"
          min="0"
          step="0.01"
          value={v.priceOverride ?? ''}
          placeholder={basePrice}
          onChange={(e) => onPatch({ priceOverride: e.target.value || null })}
          aria-invalid={!!errorFor('priceOverride')}
        />
      </StockRowField>
      <StockRowField id={`sale-${rowKey}`} label={t('salePrice')} error={errorFor('salePrice')}>
        <Input
          id={`sale-${rowKey}`}
          type="number"
          min="0"
          step="0.01"
          value={v.salePrice ?? ''}
          onChange={(e) => onPatch({ salePrice: e.target.value || null })}
          aria-invalid={!!errorFor('salePrice')}
        />
      </StockRowField>
      <StockRowField id={`sale-start-${rowKey}`} label={t('saleStart')} error={errorFor('saleStart')}>
        <Input
          id={`sale-start-${rowKey}`}
          type="date"
          value={dateValue(v.saleStart)}
          onChange={(e) => onPatch({ saleStart: e.target.value || null })}
          aria-invalid={!!errorFor('saleStart')}
        />
      </StockRowField>
      <StockRowField id={`sale-end-${rowKey}`} label={t('saleEnd')} error={errorFor('saleEnd')}>
        <Input
          id={`sale-end-${rowKey}`}
          type="date"
          value={dateValue(v.saleEnd)}
          onChange={(e) => onPatch({ saleEnd: e.target.value || null })}
          aria-invalid={!!errorFor('saleEnd')}
        />
      </StockRowField>
    </>
  );
}
