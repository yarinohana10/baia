'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronDown, ChevronUp, Infinity as InfinityIcon, Plus, Trash2 } from 'lucide-react';
import type { FieldErrors } from './product-form-errors';

export type Variant = {
  id?: string;
  tempId?: string;
  color: string;
  size: string;
  sku: string;
  /** SKU is generated from slug/color/size until the admin edits it. */
  autoSku?: boolean;
  stockQuantity: number;
  /** false = unlimited stock. */
  trackInventory?: boolean;
  priceOverride: number | string | null;
  salePrice: number | string | null;
  saleStart: string | null;
  saleEnd: string | null;
  isActive: boolean;
};

export type SizeSet = { id: string; key: string; nameHe: string; nameEn: string; sizes: string[] };

export const LOW_STOCK_THRESHOLD = 5;

const isUnlimited = (v: Variant) => v.trackInventory === false;
const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Short stable code for names that don't slugify (e.g. Hebrew colors). */
function shortHash(text: string) {
  let h = 5381;
  for (const ch of text) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  return h.toString(36).slice(0, 4);
}

export function autoSku(prefix: string, color: string, size: string) {
  const c = slugify(color) || shortHash(color.trim().toLowerCase());
  const s = slugify(size) || shortHash(size.trim().toLowerCase());
  return [slugify(prefix) || 'sku', c, s].join('-');
}

/** Payload-ready stats for the summary line and validation. */
export function stockSummary(variants: Variant[]) {
  const active = variants.filter((v) => v.isActive);
  return {
    sizes: active.length,
    units: active.filter((v) => !isUnlimited(v)).reduce((sum, v) => sum + (v.stockQuantity || 0), 0),
    unlimited: active.filter(isUnlimited).length,
    zero: active.filter((v) => !isUnlimited(v) && v.stockQuantity === 0).length,
  };
}

type Block = { key: string; name: string };

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

  const [blocks, setBlocks] = useState<Block[]>(() => {
    const names: string[] = [];
    for (const v of variants) if (!names.some((n) => sameColor(n, v.color))) names.push(v.color);
    return (names.length ? names : ['']).map((name) => ({ key: crypto.randomUUID(), name }));
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState<Record<string, string>>({});
  const [customSize, setCustomSize] = useState<Record<string, string>>({});
  const focusAfterRender = useRef<string | null>(null);

  const currentSizeSet = sizeSets.find((s) => s.id === sizeSetId);
  const setSizes = useMemo(() => currentSizeSet?.sizes ?? [], [currentSizeSet]);
  const setName = (s: SizeSet) => (locale === 'he' ? s.nameHe : s.nameEn);
  const keyOf = (v: Variant) => v.id ?? v.tempId!;

  // Keep generated SKUs in step with the slug
  useEffect(() => {
    if (!variants.some((v) => v.autoSku)) return;
    const next = variants.map((v) => (v.autoSku ? { ...v, sku: autoSku(skuPrefix, v.color, v.size) } : v));
    if (next.some((v, i) => v.sku !== variants[i].sku)) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuPrefix]);

  useEffect(() => {
    if (!focusAfterRender.current) return;
    document.getElementById(focusAfterRender.current)?.focus();
    focusAfterRender.current = null;
  });

  const indexOf = (v: Variant) => variants.findIndex((x) => keyOf(x) === keyOf(v));
  const err = (v: Variant, field: string) => errors[`variants.${indexOf(v)}.${field}`];

  const patch = (target: Variant, changes: Partial<Variant>) => {
    onChange(variants.map((v) => (keyOf(v) === keyOf(target) ? { ...v, ...changes } : v)));
    const i = indexOf(target);
    onFieldEdited('variants', ...Object.keys(changes).map((f) => `variants.${i}.${f}`));
  };

  const sizesFor = (block: Block) => {
    const own = variants.filter((v) => sameColor(v.color, block.name)).map((v) => v.size);
    return [...setSizes, ...own.filter((s, i) => !setSizes.includes(s) && own.indexOf(s) === i)];
  };
  const variantFor = (block: Block, size: string) =>
    variants.find((v) => sameColor(v.color, block.name) && v.size === size);

  const newVariant = (color: string, size: string, base?: Partial<Variant>): Variant => ({
    tempId: crypto.randomUUID(),
    color,
    size,
    sku: autoSku(skuPrefix, color, size),
    autoSku: true,
    stockQuantity: 0,
    trackInventory: true,
    priceOverride: null,
    salePrice: null,
    saleStart: null,
    saleEnd: null,
    isActive: true,
    ...base,
  });

  /** Ticks a size on (creating it) or off (new rows are dropped, saved rows deactivated). */
  const setAvailable = (block: Block, size: string, available: boolean, list = variants): Variant[] => {
    const existing = list.find((v) => sameColor(v.color, block.name) && v.size === size);
    if (available) {
      if (existing) return list.map((v) => (v === existing ? { ...v, isActive: true } : v));
      return [...list, newVariant(block.name.trim(), size)];
    }
    if (!existing) return list;
    if (existing.id) return list.map((v) => (v === existing ? { ...v, isActive: false } : v));
    return list.filter((v) => v !== existing);
  };

  const toggleSize = (block: Block, size: string, available: boolean) => {
    onChange(setAvailable(block, size, available));
    onFieldEdited('variants');
    if (available) focusAfterRender.current = `stock-${block.key}-${size}`;
  };

  const setAll = (block: Block, available: boolean) => {
    let next = variants;
    for (const size of sizesFor(block)) next = setAvailable(block, size, available, next);
    onChange(next);
    onFieldEdited('variants');
  };

  const blockVariants = (block: Block) => variants.filter((v) => v.isActive && sameColor(v.color, block.name));

  const applyBulkQty = (block: Block) => {
    const qty = Number(bulkQty[block.key]);
    if (!Number.isInteger(qty) || qty < 0) return;
    const targets = new Set(blockVariants(block).map(keyOf));
    onChange(variants.map((v) => (targets.has(keyOf(v)) ? { ...v, stockQuantity: qty, trackInventory: true } : v)));
    setBulkQty((prev) => ({ ...prev, [block.key]: '' }));
  };

  const setBlockUnlimited = (block: Block, unlimited: boolean) => {
    const targets = new Set(blockVariants(block).map(keyOf));
    onChange(variants.map((v) => (targets.has(keyOf(v)) ? { ...v, trackInventory: !unlimited } : v)));
  };

  const renameBlock = (block: Block, name: string) => {
    onChange(
      variants.map((v) =>
        sameColor(v.color, block.name) && (block.name.trim() !== '' || !v.id)
          ? { ...v, color: name, ...(v.autoSku ? { sku: autoSku(skuPrefix, name, v.size) } : {}) }
          : v,
      ),
    );
    setBlocks(blocks.map((b) => (b.key === block.key ? { ...b, name } : b)));
    onFieldEdited('variants', ...variants.filter((v) => sameColor(v.color, block.name)).map((v) => `variants.${indexOf(v)}.color`));
  };

  const removeBlock = (block: Block) => {
    onChange(
      variants
        .filter((v) => !(sameColor(v.color, block.name) && !v.id))
        .map((v) => (sameColor(v.color, block.name) ? { ...v, isActive: false } : v)),
    );
    const rest = blocks.filter((b) => b.key !== block.key);
    setBlocks(rest.length ? rest : [{ key: crypto.randomUUID(), name: '' }]);
  };

  const addCustomSize = (block: Block) => {
    const size = (customSize[block.key] ?? '').trim();
    if (!size || variantFor(block, size)?.isActive) return;
    onChange(setAvailable(block, size, true));
    setCustomSize((prev) => ({ ...prev, [block.key]: '' }));
    focusAfterRender.current = `stock-${block.key}-${size}`;
  };

  const summary = stockSummary(variants);
  const duplicateColor = (block: Block) =>
    block.name.trim() !== '' && blocks.some((b) => b.key !== block.key && sameColor(b.name, block.name));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{ts('intro')}</p>

      <div className="grid grid-cols-1 gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="product-size-set" className="mb-1 text-xs font-medium text-muted-foreground">
            {t('sizeSet')}
          </Label>
          <select
            id="product-size-set"
            value={sizeSetId}
            onChange={(e) => onSizeSetChange(e.target.value)}
            className={selectClassName()}
          >
            {sizeSets.map((s) => (
              <option key={s.id} value={s.id}>
                {setName(s)}
              </option>
            ))}
            <option value="">{t('customSizes')}</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{currentSizeSet ? ts('sizeChartHint') : t('customSizesHint')}</p>
        </div>
        <div className="flex flex-col justify-end text-sm" aria-live="polite">
          <p className="font-medium text-foreground">
            {ts('summary', { sizes: summary.sizes, units: summary.units })}
            {summary.unlimited > 0 && <span className="text-muted-foreground"> · {ts('summaryUnlimited', { count: summary.unlimited })}</span>}
          </p>
        </div>
      </div>

      {summary.sizes === 0 && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {errors.variants ?? ts('noSizesWarning')}
        </p>
      )}
      {summary.zero > 0 && (
        <p className="flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {ts('zeroStockWarning', { count: summary.zero })}
        </p>
      )}

      {blocks.map((block, blockIndex) => {
        const sizes = sizesFor(block);
        const active = blockVariants(block);
        const colorError =
          (duplicateColor(block) ? t('errors.colorDuplicate') : undefined) ??
          variants.filter((v) => sameColor(v.color, block.name)).map((v) => err(v, 'color')).find(Boolean);
        const allUnlimited = active.length > 0 && active.every(isUnlimited);
        return (
          <section key={block.key} className="space-y-3 rounded-lg border border-border p-3" aria-labelledby={`color-${block.key}`}>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label id={`color-${block.key}`} htmlFor={`color-input-${block.key}`} className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('color')} {blocks.length > 1 ? blockIndex + 1 : ''} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`color-input-${block.key}`}
                  value={block.name}
                  placeholder={t('colorPlaceholder')}
                  onChange={(e) => renameBlock(block, e.target.value)}
                  aria-invalid={!!colorError}
                />
                {colorError && <p className="mt-1 text-xs text-destructive">{colorError}</p>}
              </div>
              {(blocks.length > 1 || active.length > 0) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBlock(block)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={14} /> {ts('removeColor')}
                </Button>
              )}
            </div>

            {sizes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Button type="button" variant="outline" size="xs" onClick={() => setAll(block, true)}>
                  {ts('selectAll')}
                </Button>
                <Button type="button" variant="ghost" size="xs" onClick={() => setAll(block, false)} disabled={active.length === 0}>
                  {ts('clearAll')}
                </Button>
                <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
                <Label htmlFor={`bulk-${block.key}`} className="text-xs text-muted-foreground">
                  {ts('setAllQuantity')}
                </Label>
                <Input
                  id={`bulk-${block.key}`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={bulkQty[block.key] ?? ''}
                  onChange={(e) => setBulkQty((prev) => ({ ...prev, [block.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyBulkQty(block))}
                  className="h-7 w-20"
                  disabled={active.length === 0}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => applyBulkQty(block)}
                  disabled={active.length === 0 || bulkQty[block.key] === undefined || bulkQty[block.key] === ''}
                >
                  {ts('apply')}
                </Button>
                <label className="ms-auto flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={allUnlimited}
                    disabled={active.length === 0}
                    onChange={(e) => setBlockUnlimited(block, e.target.checked)}
                    className="accent-ocean-700"
                  />
                  {ts('allUnlimited')}
                </label>
              </div>
            )}

            {sizes.length > 0 && (
              <div role="table" aria-label={ts('tableLabel', { color: block.name || t('color') })} className="divide-y divide-border rounded-md border border-border">
                <div role="row" className="hidden grid-cols-[90px_1fr_auto_auto] gap-3 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:grid">
                  <span role="columnheader">{t('size')}</span>
                  <span role="columnheader">{ts('quantity')}</span>
                  <span role="columnheader">{ts('unlimited')}</span>
                  <span role="columnheader" className="sr-only">
                    {ts('moreOptions')}
                  </span>
                </div>
                {sizes.map((size) => {
                  const v = variantFor(block, size);
                  const on = !!v?.isActive;
                  const rowKey = `${block.key}-${size}`;
                  const unlimited = !!v && isUnlimited(v);
                  const rowErrors = v ? ['sku', 'stockQuantity', 'priceOverride', 'salePrice', 'saleStart', 'saleEnd'].some((f) => err(v, f)) : false;
                  const open = on && (expanded.has(rowKey) || rowErrors);
                  const low = on && !unlimited && v!.stockQuantity > 0 && v!.stockQuantity <= LOW_STOCK_THRESHOLD;
                  const soldOut = on && !unlimited && v!.stockQuantity === 0;
                  return (
                    <div
                      role="row"
                      key={size}
                      data-testid="size-row"
                      className={cn(!on && 'bg-muted/20', soldOut && 'bg-destructive/5', low && 'bg-amber-50')}
                    >
                      <div className="grid grid-cols-[90px_1fr_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[90px_1fr_auto_auto]">
                        <label role="cell" className="flex cursor-pointer items-center gap-2 text-sm font-medium" dir="ltr">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) => toggleSize(block, size, e.target.checked)}
                            className="size-4 accent-ocean-700"
                            aria-label={ts('availableSize', { size })}
                          />
                          {size}
                        </label>
                        <div role="cell" className="min-w-0">
                          {!on ? (
                            <span className="text-xs text-muted-foreground">{ts('notAvailable')}</span>
                          ) : unlimited ? (
                            <span className="inline-flex items-center gap-1 text-sm text-ocean-700">
                              <InfinityIcon size={16} /> {ts('unlimitedHint')}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                id={`stock-${rowKey}`}
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                value={v!.stockQuantity}
                                onChange={(e) => patch(v!, { stockQuantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                                onFocus={(e) => e.target.select()}
                                aria-label={ts('quantityFor', { size })}
                                aria-invalid={!!err(v!, 'stockQuantity')}
                                className="h-8 w-24"
                              />
                              {soldOut && <span className="text-xs text-destructive">{ts('soldOut')}</span>}
                              {low && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                                  <AlertTriangle size={12} /> {ts('lowStock')}
                                </span>
                              )}
                            </div>
                          )}
                          {on && err(v!, 'stockQuantity') && <p className="mt-1 text-xs text-destructive">{err(v!, 'stockQuantity')}</p>}
                        </div>
                        <label role="cell" className={cn('flex items-center gap-1.5 text-xs', on ? 'cursor-pointer' : 'opacity-40')}>
                          <input
                            type="checkbox"
                            checked={unlimited}
                            disabled={!on}
                            onChange={(e) => patch(v!, { trackInventory: !e.target.checked })}
                            className="accent-ocean-700"
                            aria-label={ts('unlimitedFor', { size })}
                          />
                          <span className="hidden sm:inline">{ts('unlimited')}</span>
                          <InfinityIcon size={14} className="sm:hidden" aria-hidden />
                        </label>
                        <div role="cell" className="col-span-3 sm:col-span-1">
                          {on && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(rowKey)) next.delete(rowKey);
                                  else next.add(rowKey);
                                  return next;
                                })
                              }
                              aria-expanded={open}
                              className="inline-flex items-center gap-1 text-xs text-ocean-600 hover:text-ocean-800"
                            >
                              {ts('moreOptions')} {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {open && v && (
                        <div className="grid grid-cols-1 gap-3 border-t border-dashed border-border px-3 py-2 sm:grid-cols-5">
                          <RowField id={`sku-${rowKey}`} label={t('sku')} error={err(v, 'sku')}>
                            <Input
                              id={`sku-${rowKey}`}
                              dir="ltr"
                              value={v.sku}
                              onChange={(e) => patch(v, { sku: e.target.value, autoSku: false })}
                              aria-invalid={!!err(v, 'sku')}
                            />
                          </RowField>
                          <RowField id={`price-${rowKey}`} label={t('priceOverride')} error={err(v, 'priceOverride')}>
                            <Input
                              id={`price-${rowKey}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={v.priceOverride ?? ''}
                              placeholder={basePrice}
                              onChange={(e) => patch(v, { priceOverride: e.target.value || null })}
                              aria-invalid={!!err(v, 'priceOverride')}
                            />
                          </RowField>
                          <RowField id={`sale-${rowKey}`} label={t('salePrice')} error={err(v, 'salePrice')}>
                            <Input
                              id={`sale-${rowKey}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={v.salePrice ?? ''}
                              onChange={(e) => patch(v, { salePrice: e.target.value || null })}
                              aria-invalid={!!err(v, 'salePrice')}
                            />
                          </RowField>
                          <RowField id={`sale-start-${rowKey}`} label={t('saleStart')} error={err(v, 'saleStart')}>
                            <Input
                              id={`sale-start-${rowKey}`}
                              type="date"
                              value={v.saleStart ? v.saleStart.split('T')[0] : ''}
                              onChange={(e) => patch(v, { saleStart: e.target.value || null })}
                              aria-invalid={!!err(v, 'saleStart')}
                            />
                          </RowField>
                          <RowField id={`sale-end-${rowKey}`} label={t('saleEnd')} error={err(v, 'saleEnd')}>
                            <Input
                              id={`sale-end-${rowKey}`}
                              type="date"
                              value={v.saleEnd ? v.saleEnd.split('T')[0] : ''}
                              onChange={(e) => patch(v, { saleEnd: e.target.value || null })}
                              aria-invalid={!!err(v, 'saleEnd')}
                            />
                          </RowField>
                        </div>
                      )}
                      {v && err(v, 'size') && <p className="px-3 pb-2 text-xs text-destructive">{err(v, 'size')}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                aria-label={ts('addCustomSize')}
                value={customSize[block.key] ?? ''}
                maxLength={20}
                dir="ltr"
                placeholder={t('customSizePlaceholder')}
                onChange={(e) => setCustomSize((prev) => ({ ...prev, [block.key]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSize(block))}
                className="h-8 max-w-48"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addCustomSize(block)}
                disabled={!(customSize[block.key] ?? '').trim()}
              >
                <Plus size={14} /> {ts('addCustomSize')}
              </Button>
            </div>
          </section>
        );
      })}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setBlocks([...blocks, { key: crypto.randomUUID(), name: '' }])}
        className="text-ocean-600 hover:text-ocean-700"
      >
        <Plus size={14} /> {ts('addColor')}
      </Button>
    </div>
  );
}

function RowField({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="mb-0.5 text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
