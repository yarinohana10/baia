import type { OrderStatus, Prisma } from '../generated/prisma';

/** Appends to the order's status history. `changedByEmail` is null for system changes (payment webhook, sweeper). */
export function recordStatusEvent(
  tx: Prisma.TransactionClient,
  orderId: string,
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus,
  changedByEmail: string | null,
) {
  return tx.orderStatusEvent.create({ data: { orderId, fromStatus, toStatus, changedByEmail } });
}
