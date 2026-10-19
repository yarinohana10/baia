'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Infinity as InfinityIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StockRowDetails } from './StockRowDetails';
import { StockQuantityCell } from './StockQuantityCell';
import { isUnlimited, stockLevel, type StockLevel, type Variant } from './stock-variants';

const ROW_TINT: Record<StockLevel, string | undefined> = {
  off: 'bg-muted/20',
  unlimited: undefined,
  soldOut: 'bg-destructive/5',
  low: 'bg-amber-50',
  ok: undefined,
};

/** Fields shown under "more options"; an error in one of them opens the row. */
const DETAIL_FIELDS = ['sku', 'stockQuantity', 'priceOverride', 'salePrice', 'saleStart', 'saleEnd'];

type Props = {
  size: string;
  /** The size's variant in this color, if it was ever ticked. */
  variant: Variant | undefined;
  rowKey: string;
  basePrice: string;
  errorFor: (variant: Variant, field: string) => string | undefined;
  onToggle: (size: string, available: boolean) => void;
  onPatch: (variant: Variant, changes: Partial<Variant>) => void;
};

/** One size of a color: availability, quantity (or unlimited) and more options. */
export function StockSizeRow({ size, variant: v, rowKey, basePrice, errorFor, onToggle, onPatch }: Props) {
  const ts = useTranslations('admin.productForm.stock');
  const [expanded, setExpanded] = useState(false);
  const level = stockLevel(v);
  const on = level !== 'off';
  const unlimited = !!v && isUnlimited(v);
  const rowErrors = !!v && DETAIL_FIELDS.some((f) => errorFor(v, f));
  const open = on && (expanded || rowErrors);
  const quantityError = v && errorFor(v, 'stockQuantity');
  const sizeError = v && errorFor(v, 'size');

  return (
    <tbody data-testid="size-row" className={cn('block', ROW_TINT[level])}>
      <tr className="grid grid-cols-[90px_1fr_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[90px_1fr_120px_150px]">
        <td>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium" dir="ltr">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => onToggle(size, e.target.checked)}
              className="size-4 accent-ocean-700"
              aria-label={ts('availableSize', { size })}
            />
            {size}
          </label>
        </td>
        <td className="min-w-0">
          <StockQuantityCell
            size={size}
            variant={v}
            inputId={`stock-${rowKey}`}
            error={quantityError}
            onQuantityChange={(stockQuantity) => v && onPatch(v, { stockQuantity })}
          />
          {on && quantityError && <p className="mt-1 text-xs text-destructive">{quantityError}</p>}
        </td>
        <td>
          <label className={cn('flex items-center gap-1.5 text-xs', on ? 'cursor-pointer' : 'opacity-40')}>
            <input
              type="checkbox"
              checked={unlimited}
              disabled={!on}
              onChange={(e) => v && onPatch(v, { trackInventory: !e.target.checked })}
              className="accent-ocean-700"
              aria-label={ts('unlimitedFor', { size })}
            />
            <span className="hidden sm:inline">{ts('unlimited')}</span>
            <InfinityIcon size={14} className="sm:hidden" aria-hidden />
          </label>
        </td>
        <td className="col-span-3 sm:col-span-1">
          {on && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-xs text-ocean-600 hover:text-ocean-800"
            >
              {ts('moreOptions')} {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </td>
      </tr>

      {open && v && (
        <tr className="block">
          <td colSpan={4} className="grid grid-cols-1 gap-3 border-t border-dashed border-border px-3 py-2 sm:grid-cols-5">
            <StockRowDetails
              variant={v}
              rowKey={rowKey}
              basePrice={basePrice}
              errorFor={(field) => errorFor(v, field)}
              onPatch={(changes) => onPatch(v, changes)}
            />
          </td>
        </tr>
      )}
      {sizeError && (
        <tr className="block">
          <td colSpan={4} className="block px-3 pb-2 text-xs text-destructive">
            {sizeError}
          </td>
        </tr>
      )}
    </tbody>
  );
}
