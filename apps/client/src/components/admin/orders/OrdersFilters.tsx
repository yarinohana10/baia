'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FilterChips } from '@/components/admin/common/FilterChips';
import { SearchField } from '@/components/admin/common/SearchField';
import { useOrderStatusLabel } from '@/hooks/admin/useOrderStatusLabel';
import type { OrdersFilters as Filters } from './order-filters';
import { ORDER_STATUSES } from './types';

type Controls = {
  setSearch: (value: string) => void;
  setStatus: (status: string) => void;
  setFrom: (day: string) => void;
  setTo: (day: string) => void;
};

/** Search box, status chips, from / to days and the CSV export; they all narrow the list and the export. */
export function OrdersFilters({
  filters,
  search,
  reversed,
  controls,
  onExport,
  exporting,
  exportFailed,
}: {
  filters: Filters;
  /** What is in the search box (the applied term is `filters.search`). */
  search: string;
  reversed: boolean;
  controls: Controls;
  onExport: () => void;
  exporting: boolean;
  exportFailed: boolean;
}) {
  const t = useTranslations('admin.orders');
  const tc = useTranslations('admin.orderCards.filters');
  const statusLabel = useOrderStatusLabel();
  const id = useId();
  const options = [{ value: '', label: t('all') }, ...ORDER_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))];

  return (
    <div className="mb-6 space-y-4">
      <SearchField value={search} onChange={controls.setSearch} placeholder={t('searchPlaceholder')} />
      <div className="[&>div]:mb-0">
        <FilterChips options={options} selected={filters.status} onSelect={controls.setStatus} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-from`}>{tc('from')}</Label>
          <Input
            id={`${id}-from`}
            type="date"
            dir="ltr"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => controls.setFrom(e.target.value)}
            aria-invalid={reversed}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-to`}>{tc('to')}</Label>
          <Input
            id={`${id}-to`}
            type="date"
            dir="ltr"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => controls.setTo(e.target.value)}
            aria-invalid={reversed}
            className="w-40"
          />
        </div>
        {(filters.from || filters.to) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              controls.setFrom('');
              controls.setTo('');
            }}
          >
            {tc('clearDates')}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ms-auto gap-2"
          onClick={onExport}
          disabled={exporting}
          aria-busy={exporting}
        >
          <Download size={14} aria-hidden="true" />
          {exporting ? tc('exporting') : tc('export')}
        </Button>
      </div>
      {reversed && (
        <p role="alert" className="text-xs text-destructive">
          {tc('reversed')}
        </p>
      )}
      {exportFailed && (
        <p role="alert" className="text-xs text-destructive">
          {tc('exportFailed')}
        </p>
      )}
    </div>
  );
}
