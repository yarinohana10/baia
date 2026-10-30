'use client';

import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  index: number;
  total: number;
  /** What the buttons act on, for screen readers ("Table 2"). */
  label: string;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

/** Move up / move down / remove buttons for an item in an editable list. */
export function ListControls({ index, total, label, onMove, onRemove }: Props) {
  const t = useTranslations('admin.sizeGuides');
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t('moveUp', { item: label })}>
        <ArrowUp size={15} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index === total - 1}
        onClick={() => onMove(1)}
        aria-label={t('moveDown', { item: label })}
      >
        <ArrowDown size={15} />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t('remove', { item: label })} className="text-destructive">
        <Trash2 size={15} />
      </Button>
    </div>
  );
}
