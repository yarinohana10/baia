'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { formatShekels as money } from '@/components/admin/order-status';
import type { RefundState } from './order-utils';

/** "Refund Pending - ₪120.00" (amber) while the money is owed, "Refunded - ₪120.00" (green) once returned. */
export function OrderRefundChip({ state }: { state: RefundState }) {
  const t = useTranslations('admin.orderCards.refund');
  const pending = state.kind === 'pending';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        pending ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700',
      )}
    >
      {t(pending ? 'pendingChip' : 'completedChip', { amount: money(state.refund.amount) })}
    </span>
  );
}
