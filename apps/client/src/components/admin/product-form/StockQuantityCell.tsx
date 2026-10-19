'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Infinity as InfinityIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { stockLevel, type Variant } from './stock-variants';

type Props = {
  size: string;
  /** The size's variant in this color, if it was ever ticked. */
  variant: Variant | undefined;
  inputId: string;
  error: string | undefined;
  onQuantityChange: (quantity: number) => void;
};

/** "Not available", "unlimited", or the quantity input with sold-out / low-stock hints. */
export function StockQuantityCell({ size, variant: v, inputId, error, onQuantityChange }: Props) {
  const ts = useTranslations('admin.productForm.stock');
  const level = stockLevel(v);
  if (!v || level === 'off') return <span className="text-xs text-muted-foreground">{ts('notAvailable')}</span>;
  if (level === 'unlimited') {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-ocean-700">
        <InfinityIcon size={16} /> {ts('unlimitedHint')}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        id={inputId}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={v.stockQuantity}
        onChange={(e) => onQuantityChange(e.target.value === '' ? 0 : Number(e.target.value))}
        onFocus={(e) => e.target.select()}
        aria-label={ts('quantityFor', { size })}
        aria-invalid={!!error}
        className="h-8 w-24"
      />
      {level === 'soldOut' && <span className="text-xs text-destructive">{ts('soldOut')}</span>}
      {level === 'low' && (
        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle size={12} /> {ts('lowStock')}
        </span>
      )}
    </div>
  );
}
