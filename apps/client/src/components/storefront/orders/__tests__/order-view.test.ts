import { describe, expect, it } from 'vitest';
import { orderPhase, viewerAccess } from '../order-view';
import { DEADLINE, formatOrderDate, ORDER_DATE_TIME } from '../order-dates';

describe('orderPhase', () => {
  it('thanks the shopper for fresh orders only', () => {
    expect(orderPhase('PENDING_PAYMENT')).toEqual({ pending: true, closed: false, paid: false, justPlaced: true, notYetShipped: true });
    expect(orderPhase('CONFIRMED')).toMatchObject({ paid: true, justPlaced: true, notYetShipped: true });
    expect(orderPhase('SHIPPED')).toMatchObject({ paid: true, justPlaced: false, notYetShipped: false });
    expect(orderPhase('REFUNDED')).toMatchObject({ closed: true, paid: false, justPlaced: false });
  });
});

describe('viewerAccess', () => {
  const guestOrder = { userId: null, status: 'PENDING_PAYMENT' as const };
  const userOrder = { userId: 'u1', status: 'PENDING_PAYMENT' as const };

  it('lets the owner and token holders pay and cancel', () => {
    expect(viewerAccess(userOrder, { id: 'u1' }, null)).toEqual({ isOwner: true, canCancel: true, canPay: true });
    expect(viewerAccess(guestOrder, null, 'tok')).toEqual({ isOwner: false, canCancel: true, canPay: true });
  });

  it('keeps other accounts and admins read-only', () => {
    expect(viewerAccess(userOrder, { id: 'u2' }, null)).toEqual({ isOwner: false, canCancel: false, canPay: false });
    expect(viewerAccess(guestOrder, { id: 'admin', role: 'ADMIN' }, null)).toMatchObject({ canCancel: false, canPay: true });
  });

  it('only offers payment while the order awaits it', () => {
    expect(viewerAccess({ ...userOrder, status: 'CONFIRMED' }, { id: 'u1' }, null).canPay).toBe(false);
  });
});

describe('order dates', () => {
  it('formats in Israel time whatever the runtime time zone', () => {
    // 22:30 UTC is already the next day in Israel (UTC+3 in summer).
    expect(formatOrderDate(ORDER_DATE_TIME, '2026-06-14T22:30:00Z', 'en')).toContain('15 Jun 2026');
    expect(formatOrderDate(DEADLINE, '2026-06-14T22:30:00Z', 'en')).toContain('01:30');
  });
});
