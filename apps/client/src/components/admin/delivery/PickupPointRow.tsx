'use client';

import { useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { PickupPoint } from './types';

type Props = {
  point: PickupPoint;
  onToggleActive: (point: PickupPoint) => void;
  onEdit: (point: PickupPoint) => void;
  onDelete: (point: PickupPoint) => void;
};

export function PickupPointRow({ point, onToggleActive, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.delivery');
  return (
    <tr className={cn('border-b border-border', !point.isActive && 'opacity-60')}>
      <td className="px-3 py-3">
        <p className="font-medium text-foreground">{point.name}</p>
        <p className="text-xs text-muted-foreground">{point.address}</p>
      </td>
      <td className="px-3 py-3 text-muted-foreground">{point.city}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{point.hours || '—'}</td>
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={() => onToggleActive(point)}
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs',
            point.isActive ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground',
          )}
          aria-label={point.isActive ? t('deactivate', { name: point.name }) : t('activate', { name: point.name })}
        >
          {point.isActive ? t('active') : t('inactive')}
        </button>
      </td>
      <td className="px-3 py-3 text-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit(point)}
          aria-label={t('edit', { name: point.name })}
          className="text-muted-foreground hover:text-ocean-700"
        >
          <Pencil size={14} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(point)}
          aria-label={t('delete', { name: point.name })}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 size={14} />
        </Button>
      </td>
    </tr>
  );
}
