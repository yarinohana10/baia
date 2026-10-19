'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FieldErrors } from './product-form-errors';
import { StockOverview } from './product-form/StockOverview';
import { StockColorBlock, type ColorBlockActions } from './product-form/StockColorBlock';
import {
  findVariant,
  initialColorBlocks,
  patchActiveOfColor,
  removeColor,
  renameColor,
  sameColor,
  setSizeAvailable,
  sizesForColor,
  stockSummary,
  variantKey,
  variantsOfColor,
  type ColorBlock,
  type SizeSet,
  type Variant,
} from './product-form/stock-variants';

type Props = {
  variants: Variant[];
  onChange: (next: Variant[]) => void;
  sizeSets: SizeSet[];
  sizeSetId: string;
  onSizeSetChange: (id: string) => void;
  locale: string;
  skuPrefix: string;
  basePrice: string;
  errors: FieldErrors;
  onFieldEdited: (...fields: string[]) => void;
  selectClassName: (hasError?: boolean) => string;
};

/** Sizes and stock per color: tick the sizes a color comes in and set each one's quantity. */
export default function ProductStockEditor({
  variants,
  onChange,
  sizeSets,
  sizeSetId,
  onSizeSetChange,
  locale,
  skuPrefix,
  basePrice,
  errors,
  onFieldEdited,
  selectClassName,
}: Props) {
  const t = useTranslations('admin.productForm');
  const ts = useTranslations('admin.productForm.stock');
  const [blocks, setBlocks] = useState<ColorBlock[]>(() => initialColorBlocks(variants));
  const nextBlockKey = useRef(0);
  const newBlock = (): ColorBlock => ({ key: `n${(nextBlockKey.current += 1)}`, name: '' });
  // Id of an input to focus once the row it belongs to has rendered.
  const focusAfterRender = useRef<string | null>(null);

  useEffect(() => {
    if (!focusAfterRender.current) return;
    document.getElementById(focusAfterRender.current)?.focus();
    focusAfterRender.current = null;
  });

  const setSizes = sizeSets.find((s) => s.id === sizeSetId)?.sizes ?? [];
  const indexByKey = new Map(variants.map((v, i) => [variantKey(v), i]));
  const pathOf = (v: Variant, field: string) => `variants.${indexByKey.get(variantKey(v))}.${field}`;
  const errorFor = (v: Variant, field: string) => errors[pathOf(v, field)];

  const colorErrorFor = (block: ColorBlock) => {
    const duplicate =
      block.name.trim() !== '' && blocks.some((b) => b.key !== block.key && sameColor(b.name, block.name));
    if (duplicate) return t('errors.colorDuplicate');
    for (const v of variantsOfColor(variants, block.name)) {
      const error = errorFor(v, 'color');
      if (error) return error;
    }
    return undefined;
  };

  const actions: ColorBlockActions = {
    onRename: (block, name) => {
      onChange(renameColor(variants, block.name, name, skuPrefix));
      setBlocks(blocks.map((b) => (b.key === block.key ? { ...b, name } : b)));
      onFieldEdited('variants', ...variantsOfColor(variants, block.name).map((v) => pathOf(v, 'color')));
    },
    onRemove: (block) => {
      onChange(removeColor(variants, block.name));
      const rest = blocks.filter((b) => b.key !== block.key);
      setBlocks(rest.length ? rest : [newBlock()]);
    },
    onToggleSize: (block, size, available) => {
      onChange(setSizeAvailable(variants, block.name, size, available, skuPrefix));
      onFieldEdited('variants');
      if (available) focusAfterRender.current = `stock-${block.key}-${size}`;
    },
    onSetAll: (block, available) => {
      let next = variants;
      for (const size of sizesForColor(variants, block.name, setSizes)) {
        next = setSizeAvailable(next, block.name, size, available, skuPrefix);
      }
      onChange(next);
      onFieldEdited('variants');
    },
    onPatchActive: (block, changes) => onChange(patchActiveOfColor(variants, block.name, changes)),
    onPatch: (target, changes) => {
      onChange(variants.map((v) => (variantKey(v) === variantKey(target) ? { ...v, ...changes } : v)));
      onFieldEdited('variants', ...Object.keys(changes).map((f) => pathOf(target, f)));
    },
    onAddCustomSize: (block, size) => {
      if (findVariant(variants, block.name, size)?.isActive) return false;
      onChange(setSizeAvailable(variants, block.name, size, true, skuPrefix));
      focusAfterRender.current = `stock-${block.key}-${size}`;
      return true;
    },
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{ts('intro')}</p>

      <StockOverview
        sizeSets={sizeSets}
        sizeSetId={sizeSetId}
        onSizeSetChange={onSizeSetChange}
        locale={locale}
        summary={stockSummary(variants)}
        variantsError={errors.variants}
        selectClassName={selectClassName}
      />

      {blocks.map((block, blockIndex) => {
        const blockVariants = variantsOfColor(variants, block.name);
        return (
          <StockColorBlock
            key={block.key}
            block={block}
            number={blocks.length > 1 ? blockIndex + 1 : null}
            variants={variants}
            sizes={sizesForColor(variants, block.name, setSizes)}
            colorError={colorErrorFor(block)}
            removable={blocks.length > 1 || blockVariants.some((v) => v.isActive)}
            basePrice={basePrice}
            errorFor={errorFor}
            {...actions}
          />
        );
      })}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setBlocks([...blocks, newBlock()])}
        disabled={blocks.some((b) => !b.name.trim())}
        className="text-ocean-600 hover:text-ocean-700"
      >
        <Plus size={14} /> {ts('addColor')}
      </Button>
    </div>
  );
}
