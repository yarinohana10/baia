import { isClosed, type CustomerOrder } from '@/lib/orders';

/** Where an order stands, for the order page's wording and icons. */
export type OrderPhase = {
  pending: boolean;
  /** Cancelled or refunded (e.g. unpaid for 60 minutes): neither "placed" nor payable. */
  closed: boolean;
  paid: boolean;
  /** Fresh from checkout (paid or awaiting payment): thank the shopper; otherwise it is a status page. */
  justPlaced: boolean;
  notYetShipped: boolean;
};

export function orderPhase(status: CustomerOrder['status']): OrderPhase {
  const pending = status === 'PENDING_PAYMENT';
  const closed = isClosed(status);
  const paid = !pending && !closed;
  return {
    pending,
    closed,
    paid,
    justPlaced: pending || (paid && status === 'CONFIRMED'),
    notYetShipped: status === 'CONFIRMED' || status === 'PROCESSING' || pending,
  };
}

/** The signed-in viewer, if any (`role` is set on staff accounts). */
export type Viewer = { id: string; role?: string } | null | undefined;

/** What the viewer may do with the order on this page. */
export function viewerAccess(
  order: Pick<CustomerOrder, 'userId' | 'status'>,
  viewer: Viewer,
  guestToken: string | null,
): { isOwner: boolean; canCancel: boolean; canPay: boolean } {
  const isOwner = !!viewer && order.userId === viewer.id;
  return {
    isOwner,
    // Logged-out viewers could only load it with the order's token/cookie; an
    // admin (or another account) looking at someone else's order is read-only.
    canCancel: isOwner || !viewer || (!order.userId && viewer.role !== 'ADMIN'),
    // A guest order only loads with its token or cookie, which also authorise paying.
    canPay: order.status === 'PENDING_PAYMENT' && (isOwner || !!guestToken || !order.userId),
  };
}
