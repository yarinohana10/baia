import { cancellationEligibility, suggestedCancellationFee } from '../src/orders/cancellation-eligibility';
import { deliveryConfig, deliveryQuote, shippingCostFor } from '../src/orders/delivery';

const now = new Date('2026-06-01T12:00:00Z');
const order = (status: Parameters<typeof cancellationEligibility>[0]['status']) => ({ status });

describe('cancellationEligibility', () => {
  it('lets the customer cancel instantly at any point before shipping, however old the order is', () => {
    for (const status of ['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING'] as const) {
      expect(cancellationEligibility(order(status), null)).toEqual({
        canSelfCancel: true,
        canRequest: false,
        requiresReturn: false,
        openRequest: null,
      });
    }
  });

  it('switches to a Cancellation Request once the order has shipped or been delivered', () => {
    for (const status of ['SHIPPED', 'DELIVERED'] as const) {
      expect(cancellationEligibility(order(status), null)).toMatchObject({
        canSelfCancel: false,
        canRequest: true,
        requiresReturn: true,
      });
    }
  });

  it('offers nothing on closed orders', () => {
    for (const status of ['CANCELLED', 'REFUNDED'] as const) {
      expect(cancellationEligibility(order(status), null)).toMatchObject({ canSelfCancel: false, canRequest: false });
    }
  });

  it('an open request blocks both actions', () => {
    const open = { id: 'r1', status: 'REQUESTED' as const, reason: 'SIZE', createdAt: now };
    expect(cancellationEligibility(order('SHIPPED'), open)).toMatchObject({
      canSelfCancel: false,
      canRequest: false,
      openRequest: { id: 'r1', createdAt: now.toISOString() },
    });
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
