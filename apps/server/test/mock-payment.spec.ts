import { MockPaymentProvider } from '../src/payment/mock-payment.provider';
import { installmentsMinTotal } from '../src/payment/payment.service';

describe('MockPaymentProvider simulation', () => {
  const provider = new MockPaymentProvider();
  const base = { amount: 100, currency: 'ILS', orderId: 'o1', customerEmail: 'a@b.test', idempotencyKey: 'k1' };
  const prevDelay = process.env.MOCK_PAYMENT_DELAY_MS;
  beforeAll(() => {
    process.env.MOCK_PAYMENT_DELAY_MS = '0';
  });
  afterAll(() => {
    if (prevDelay === undefined) delete process.env.MOCK_PAYMENT_DELAY_MS;
    else process.env.MOCK_PAYMENT_DELAY_MS = prevDelay;
  });

  it('is a test-mode provider', () => {
    expect(provider.name).toBe('mock');
    expect(provider.testMode).toBe(true);
  });

  it('succeeds by default, for "success" and after a 3-D Secure challenge', async () => {
    for (const simulation of [undefined, 'success', '3ds'] as const) {
      const res = await provider.charge({ ...base, simulation });
      expect(res.success).toBe(true);
      expect(res.transactionId).toMatch(/^mock_/);
    }
  });

  it('declines with a stable error code', async () => {
    expect(await provider.charge({ ...base, simulation: 'decline' })).toMatchObject({
      success: false,
      errorCode: 'card_declined',
    });
    expect(await provider.charge({ ...base, simulation: 'insufficient_funds' })).toMatchObject({
      success: false,
      errorCode: 'insufficient_funds',
    });
  });
});

describe('installmentsMinTotal', () => {
  it('defaults to 300 and reads PAYMENT_INSTALLMENTS_MIN_TOTAL', () => {
    expect(installmentsMinTotal({})).toBe(300);
    expect(installmentsMinTotal({ PAYMENT_INSTALLMENTS_MIN_TOTAL: '500' })).toBe(500);
    expect(installmentsMinTotal({ PAYMENT_INSTALLMENTS_MIN_TOTAL: '0' })).toBe(0);
    expect(installmentsMinTotal({ PAYMENT_INSTALLMENTS_MIN_TOTAL: 'abc' })).toBe(300);
    expect(installmentsMinTotal({ PAYMENT_INSTALLMENTS_MIN_TOTAL: '-1' })).toBe(300);
  });
});
