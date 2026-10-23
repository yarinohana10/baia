'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminSelectClassName } from '@/components/admin/common/select-class';
import { formatShekels as money } from '@/components/admin/order-status';
import type { OrderStatusEdit } from '@/hooks/admin/useOrderStatusEdit';
import { useOrderStatusLabel } from '@/hooks/admin/useOrderStatusLabel';
import { isPaidStatus } from './order-utils';
import { EMAILED_STATUSES, type AdminOrder } from './types';

/**
 * Status select (only the transitions the server allows), refund choice for cancelling,
 * tracking number and the update button of an order card.
 */
export function OrderStatusForm({ order, edit }: { order: AdminOrder; edit: OrderStatusEdit }) {
  const t = useTranslations('admin.orders');
  const tx = useTranslations('admin.ordersExtra');
  const statusLabel = useOrderStatusLabel();
  const id = useId();
  const { draft, changing } = edit;
  const nextStatuses = order.allowedTransitions ?? [];
  const cancelling = changing && draft.status === 'CANCELLED';
  const shipping = changing && draft.status === 'SHIPPED';

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-status`}>{t('updateStatus')}</Label>
        {nextStatuses.length > 0 ? (
          <select
            id={`${id}-status`}
            value={draft.status}
            onChange={(e) => edit.setStatus(e.target.value)}
            className={adminSelectClassName()}
          >
            <option value={order.status}>{`${statusLabel(order.status)} (${t('current')})`}</option>
            {nextStatuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-muted-foreground">{t('finalStatus')}</p>
        )}
      </div>
      {changing && EMAILED_STATUSES.includes(draft.status) && (
        <p className="text-xs text-muted-foreground">{tx('customerEmailed')}</p>
      )}
      {cancelling && isPaidStatus(order.status) && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={edit.refundOnCancel}
            onChange={(e) => edit.setRefundOnCancel(e.target.checked)}
            className="accent-ocean-700"
          />
          {tx('refundOnCancel', { amount: money(order.total) })}
        </label>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-tracking`}>
          {t('trackingNumber')}
          {shipping && <span className="text-xs font-normal text-ocean-700"> · {tx('trackingForShipping')}</span>}
        </Label>
        <Input
          ref={edit.trackingInputRef}
          id={`${id}-tracking`}
          type="text"
          dir="ltr"
          maxLength={100}
          value={draft.trackingNumber}
          onChange={(e) => edit.setTrackingNumber(e.target.value)}
          placeholder="IL123456789"
          disabled={cancelling}
          aria-invalid={shipping && !draft.trackingNumber.trim()}
        />
      </div>
      {edit.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
          {edit.error}
        </p>
      )}
      <Button
        type="button"
        onClick={edit.save}
        disabled={edit.updating || edit.unchanged}
        className="bg-ocean-700 text-white hover:bg-ocean-800"
      >
        {edit.updating ? t('updating') : t('update')}
      </Button>
    </div>
  );
}
