'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminSelectClassName } from '@/components/admin/common/select-class';
import { formatShekels as money } from '@/components/admin/order-status';
import { isStatusChanging, isUpdateUnchanged } from '@/hooks/admin/order-detail';
import type { OrderDetail } from '@/hooks/admin/useOrderDetail';
import { useOrderStatusLabel } from '@/hooks/admin/useOrderStatusLabel';
import { isPaidStatus } from './order-utils';
import { EMAILED_STATUSES, type AdminOrder } from './types';

/** Status select, refund choice, tracking number and the update button of the order dialog. */
export function OrderStatusForm({ order, detail }: { order: AdminOrder; detail: OrderDetail }) {
  const t = useTranslations('admin.orders');
  const tx = useTranslations('admin.ordersExtra');
  const statusLabel = useOrderStatusLabel();
  const { state } = detail;
  const { newStatus, trackingNumber } = state;
  const nextStatuses = order.allowedTransitions ?? [];
  const changing = isStatusChanging(state);
  const cancelling = changing && newStatus === 'CANCELLED';
  const shipping = changing && newStatus === 'SHIPPED';

  return (
    <div className="border-t border-border pt-3 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="order-status">{t('updateStatus')}</Label>
        {nextStatuses.length > 0 ? (
          <select
            id="order-status"
            value={newStatus}
            onChange={(e) => detail.setStatus(e.target.value)}
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
          <p id="order-status" className="text-sm text-muted-foreground">
            {t('finalStatus')}
          </p>
        )}
      </div>
      {changing && EMAILED_STATUSES.includes(newStatus) && (
        <p className="text-xs text-muted-foreground">{tx('customerEmailed')}</p>
      )}
      {cancelling && isPaidStatus(order.status) && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.refundOnCancel}
            onChange={(e) => detail.setRefundOnCancel(e.target.checked)}
            className="accent-ocean-700"
          />
          {tx('refundOnCancel', { amount: money(order.total) })}
        </label>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="order-tracking-number">
          {t('trackingNumber')}
          {shipping && <span className="text-xs font-normal text-ocean-700"> · {tx('trackingForShipping')}</span>}
        </Label>
        <Input
          ref={detail.trackingInputRef}
          id="order-tracking-number"
          type="text"
          dir="ltr"
          maxLength={100}
          value={trackingNumber}
          onChange={(e) => detail.setTrackingNumber(e.target.value)}
          placeholder="IL123456789"
          disabled={cancelling}
          aria-invalid={shipping && !trackingNumber.trim()}
        />
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="button"
        onClick={detail.updateStatus}
        disabled={state.updating || isUpdateUnchanged(state)}
        className="bg-ocean-700 text-white hover:bg-ocean-800"
      >
        {state.updating ? t('updating') : t('update')}
      </Button>
    </div>
  );
}
