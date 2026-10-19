'use client';

import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StockBlockToolbar } from './StockBlockToolbar';
import { StockSizeRow } from './StockSizeRow';
import { CustomSizeInput } from './CustomSizeInput';
import { activeVariantsOfColor, findVariant, isUnlimited, type ColorBlock, type Variant } from './stock-variants';

export type ColorBlockActions = {
  onRename: (block: ColorBlock, name: string) => void;
  onRemove: (block: ColorBlock) => void;
  onToggleSize: (block: ColorBlock, size: string, available: boolean) => void;
  onSetAll: (block: ColorBlock, available: boolean) => void;
  onPatchActive: (block: ColorBlock, changes: Partial<Variant>) => void;
  onPatch: (variant: Variant, changes: Partial<Variant>) => void;
  onAddCustomSize: (block: ColorBlock, size: string) => boolean;
};

type Props = ColorBlockActions & {
  block: ColorBlock;
  /** 1-based number shown when there are several colors; null for a single color. */
  number: number | null;
  variants: Variant[];
  sizes: string[];
  colorError: string | undefined;
  /** The remove button is offered once there is more than one color or this one has sizes. */
  removable: boolean;
  basePrice: string;
  errorFor: (variant: Variant, field: string) => string | undefined;
};

/** One color: its name, bulk actions, a row per size and a custom-size input. */
export function StockColorBlock({
  block,
  number,
  variants,
  sizes,
  colorError,
  removable,
  basePrice,
  errorFor,
  ...actions
}: Props) {
  const t = useTranslations('admin.productForm');
  const ts = useTranslations('admin.productForm.stock');
  const active = activeVariantsOfColor(variants, block.name);
  const allUnlimited = active.length > 0 && active.every(isUnlimited);

  return (
    <section className="space-y-3 rounded-lg border border-border p-3" aria-labelledby={`color-${block.key}`}>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label id={`color-${block.key}`} htmlFor={`color-input-${block.key}`} className="mb-1 text-xs font-medium text-muted-foreground">
            {t('color')} {number ?? ''} <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`color-input-${block.key}`}
            value={block.name}
            placeholder={t('colorPlaceholder')}
            onChange={(e) => actions.onRename(block, e.target.value)}
            aria-invalid={!!colorError}
          />
          {colorError && <p className="mt-1 text-xs text-destructive">{colorError}</p>}
        </div>
        {removable && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => actions.onRemove(block)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={14} /> {ts('removeColor')}
          </Button>
        )}
      </div>

      {sizes.length > 0 && (
        <StockBlockToolbar
          blockKey={block.key}
          activeCount={active.length}
          allUnlimited={allUnlimited}
          onSetAll={(available) => actions.onSetAll(block, available)}
          onSetQuantity={(stockQuantity) => actions.onPatchActive(block, { stockQuantity, trackInventory: true })}
          onSetUnlimited={(unlimited) => actions.onPatchActive(block, { trackInventory: !unlimited })}
        />
      )}

      {sizes.length > 0 && (
        <table
          aria-label={ts('tableLabel', { color: block.name || t('color') })}
          className="block divide-y divide-border rounded-md border border-border"
        >
          <thead className="hidden sm:block">
            <tr className="grid grid-cols-[90px_1fr_120px_150px] gap-3 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <th className="text-start font-medium">{t('size')}</th>
              <th className="text-start font-medium">{ts('quantity')}</th>
              <th className="text-start font-medium">{ts('unlimited')}</th>
              <th className="sr-only">{ts('moreOptions')}</th>
            </tr>
          </thead>
          {sizes.map((size) => (
            <StockSizeRow
              key={size}
              size={size}
              variant={findVariant(variants, block.name, size)}
              rowKey={`${block.key}-${size}`}
              basePrice={basePrice}
              errorFor={errorFor}
              onToggle={(s, available) => actions.onToggleSize(block, s, available)}
              onPatch={actions.onPatch}
            />
          ))}
        </table>
      )}

      <CustomSizeInput onAdd={(size) => actions.onAddCustomSize(block, size)} />
    </section>
  );
}
