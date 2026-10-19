'use client';

import { useState } from 'react';
import type { CustomerOrder } from '@/lib/orders';
import type { CancellationMode } from '@/hooks/storefront/useCancellationSubmit';
import { CancellationActions } from './CancellationActions';
import { CancellationDone } from './CancellationDone';
import { OpenRequestNotice } from './OpenRequestNotice';

/**
 * Cancellation actions for an order the viewer owns (session or guest
 * cookie/token): an instant free cancel inside the window, otherwise a
 * request the store reviews. Calls `onUpdated` with the server's fresh order.
 */
export function OrderCancellation({
  order,
  token,
  onUpdated,
  compact = false,
}: {
  order: CustomerOrder;
  /** Guest token kept in memory on the order page (the cookie also works). */
  token?: string | null;
  onUpdated: (order: CustomerOrder) => void;
  compact?: boolean;
}) {
  const [done, setDone] = useState<CancellationMode | null>(null);
  const info = order.cancellation;
  const unpaid = order.status === 'PENDING_PAYMENT';

  if (!info) return null;
  if (done) return <CancellationDone mode={done} unpaid={unpaid} />;
  if (info.openRequest) return <OpenRequestNotice createdAt={info.openRequest.createdAt} />;
  if (!info.canSelfCancel && !info.canRequest) return null;

  return (
    <CancellationActions
      order={order}
      info={info}
      token={token}
      compact={compact}
      onDone={(mode, updated) => {
        setDone(mode);
        onUpdated(updated);
      }}
    />
  );
}
