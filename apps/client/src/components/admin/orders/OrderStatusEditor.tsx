'use client';

import type { OrderActions } from '@/hooks/admin/useOrderActions';
import { useOrderStatusEdit } from '@/hooks/admin/useOrderStatusEdit';
import { OrderStatusForm } from './OrderStatusForm';
import type { AdminOrder } from './types';

/** Holds the status form's state; mount it with `key={draftKey(order)}` so a saved change resets it. */
export function OrderStatusEditor({ order, actions }: { order: AdminOrder; actions: OrderActions }) {
  const edit = useOrderStatusEdit(order, actions);
  return <OrderStatusForm order={order} edit={edit} />;
}
