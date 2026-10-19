'use client';

import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CouponStatusBadge } from './CouponStatusBadge';
import { formatCouponDate, type Coupon } from './types';

type Props = {
  coupon: Coupon;
  onToggleActive: (coupon: Coupon) => void;
  onEdit: (coupon: Coupon) => void;
  onDelete: (id: string) => void;
};

export function CouponRow({ coupon: c, onToggleActive, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.coupons');
  return (
    <tr className="border-b border-border hover:bg-muted/50">
      <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
      <td className="px-4 py-3">
        {c.discountType === 'PERCENTAGE' ? `${parseFloat(c.value)}%` : `₪${parseFloat(c.value).toFixed(2)}`}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{c.minCartValue ? `₪${parseFloat(c.minCartValue).toFixed(2)}` : '—'}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {c.currentUses}
        {c.maxUses ? ` / ${c.maxUses}` : ''}{' '}
        <span className="text-xs text-muted-foreground">
          ({c._count.orders} {t('orders')})
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{c.expiresAt ? formatCouponDate(c.expiresAt) : t('never')}</td>
      <td className="px-4 py-3">
        <CouponStatusBadge coupon={c} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleActive(c)}
            className="text-muted-foreground hover:text-ocean-600"
            aria-label={c.isActive ? t('deactivate') : t('activateCoupon')}
          >
            {c.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(c)}
            className="text-muted-foreground hover:text-ocean-600"
            aria-label={t('editAction')}
          >
            <Pencil size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(c.id)}
            className="text-muted-foreground hover:text-destructive"
            aria-label={t('deleteAction')}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </td>
    </tr>
  );
}
