import { cancellationEligibility, suggestedCancellationFee } from '../src/orders/cancellation-eligibility';
import { deliveryConfig, deliveryQuote, shippingCostFor } from '../src/orders/delivery';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-06-01T12:00:00Z');
const paid = (hoursAgo: number, extra: Record<string, unknown> = {}) => ({
  status: 'CONFIRMED' as const,
  paidAt: new Date(now.getTime() - hoursAgo * HOUR),
  createdAt: new Date(now.getTime() - (hoursAgo + 1) * HOUR),
  shippedAt: null,
  ...extra,
});

describe('cancellationEligibility', () => {
  it('allows a free self-cancel inside the window, with its deadline', () => {
    const info = cancellationEligibility(paid(10), 48, null, now);
    expect(info).toMatchObject({ canSelfCancel: true, canRequest: true, requiresReturn: false, openRequest: null });
    expect(info.selfCancelDeadline).toBe(new Date(now.getTime() + 38 * HOUR).toISOString());
  });

  it('closes the window after N hours, and once shipped', () => {
    expect(cancellationEligibility(paid(49), 48, null, now)).toMatchObject({ canSelfCancel: false, canRequest: true, selfCancelDeadline: null });
    expect(cancellationEligibility(paid(1, { status: 'SHIPPED', shippedAt: now }), 48, null, now)).toMatchObject({
      canSelfCancel: false,
      canRequest: true,
      requiresReturn: true,
    });
  });

  it('unpaid orders can always be cancelled; closed orders never', () => {
    expect(cancellationEligibility(paid(100, { status: 'PENDING_PAYMENT', paidAt: null }), 48, null, now)).toMatchObject({
      canSelfCancel: true,
      canRequest: false,
    });
    expect(cancellationEligibility(paid(1, { status: 'CANCELLED' }), 48, null, now)).toMatchObject({ canSelfCancel: false, canRequest: false });
  });

  it('an open request blocks both actions', () => {
    const open = { id: 'r1', status: 'REQUESTED' as const, reason: 'SIZE', createdAt: now };
    expect(cancellationEligibility(paid(1), 48, open, now)).toMatchObject({ canSelfCancel: false, canRequest: false, openRequest: { id: 'r1' } });
  });

  it('suggests 5% or ₪100, the lower', () => {
    expect(suggestedCancellationFee(229.9)).toBe(11.5);
    expect(suggestedCancellationFee(5000)).toBe(100);
  });
});

describe('delivery pricing', () => {
  const cfg = deliveryConfig({ shippingCost: 30, pickupPointCost: 15, freeShippingThreshold: 300, courierEtaDays: '3-5', pickupEtaDays: '1-2' });

  it('prices each method and makes both free at the threshold', () => {
    expect(shippingCostFor('COURIER', 100, cfg)).toBe(30);
    expect(shippingCostFor('PICKUP_POINT', 100, cfg)).toBe(15);
    expect(shippingCostFor('PICKUP_POINT', 300, cfg)).toBe(0);
    expect(deliveryQuote(250, cfg).amountToFreeShipping).toBe(50);
  });

  it('falls back to the schema defaults without a config row', () => {
    expect(deliveryConfig(null)).toMatchObject({ courierCost: 29.9, pickupCost: 19.9, freeThreshold: 249 });
  });
});
