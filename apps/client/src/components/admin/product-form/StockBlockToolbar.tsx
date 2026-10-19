'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  blockKey: string;
  /** Number of available sizes in this color. */
  activeCount: number;
  allUnlimited: boolean;
  onSetAll: (available: boolean) => void;
  onSetQuantity: (quantity: number) => void;
  onSetUnlimited: (unlimited: boolean) => void;
};

/** Bulk actions for one color: select / clear all sizes, one quantity for all, all unlimited. */
export function StockBlockToolbar({ blockKey, activeCount, allUnlimited, onSetAll, onSetQuantity, onSetUnlimited }: Props) {
  const ts = useTranslations('admin.productForm.stock');
  const [bulkQty, setBulkQty] = useState('');
  const none = activeCount === 0;

  const applyBulkQty = () => {
    const qty = Number(bulkQty);
    if (!Number.isInteger(qty) || qty < 0) return;
    onSetQuantity(qty);
    setBulkQty('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Button type="button" variant="outline" size="xs" onClick={() => onSetAll(true)}>
        {ts('selectAll')}
      </Button>
      <Button type="button" variant="ghost" size="xs" onClick={() => onSetAll(false)} disabled={none}>
        {ts('clearAll')}
      </Button>
      <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
      <Label htmlFor={`bulk-${blockKey}`} className="text-xs text-muted-foreground">
        {ts('setAllQuantity')}
      </Label>
      <Input
        id={`bulk-${blockKey}`}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={bulkQty}
        onChange={(e) => setBulkQty(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          applyBulkQty();
        }}
        className="h-7 w-20"
        disabled={none}
      />
      <Button type="button" variant="outline" size="xs" onClick={applyBulkQty} disabled={none || bulkQty === ''}>
        {ts('apply')}
      </Button>
      <label className="ms-auto flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={allUnlimited}
          disabled={none}
          onChange={(e) => onSetUnlimited(e.target.checked)}
          className="accent-ocean-700"
        />
        {ts('allUnlimited')}
      </label>
    </div>
  );
}
