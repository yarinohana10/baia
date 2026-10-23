import { isRetryableTxError, withTxRetry } from '../src/common/tx-retry';
import { paymentsEnabled } from '../src/payment/payments-enabled';

describe('withTxRetry', () => {
  const deadlock = Object.assign(new Error('Transaction failed due to a write conflict or a deadlock'), { code: 'P2034' });

  it('recognises Postgres deadlock and serialization failures only', () => {
    expect(isRetryableTxError(deadlock)).toBe(true);
    expect(isRetryableTxError({ meta: { code: '40P01' } })).toBe(true);
    expect(isRetryableTxError(new Error('deadlock detected'))).toBe(true);
    expect(isRetryableTxError({ code: 'P2002' })).toBe(false);
    expect(isRetryableTxError(new Error('boom'))).toBe(false);
    expect(isRetryableTxError(null)).toBe(false);
  });

  it('runs the transaction again once after a deadlock', async () => {
    const fn = jest.fn().mockRejectedValueOnce(deadlock).mockResolvedValueOnce('ok');
    await expect(withTxRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry budget and never retries ordinary errors', async () => {
    const stuck = jest.fn().mockRejectedValue(deadlock);
    await expect(withTxRetry(stuck)).rejects.toBe(deadlock);
    expect(stuck).toHaveBeenCalledTimes(2);

    const other = jest.fn().mockRejectedValue(new Error('out of stock'));
    await expect(withTxRetry(other)).rejects.toThrow('out of stock');
    expect(other).toHaveBeenCalledTimes(1);
  });
});

describe('paymentsEnabled', () => {
  it('defaults to off in production and on elsewhere; an explicit value wins', () => {
    expect(paymentsEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(paymentsEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(paymentsEnabled({})).toBe(true);
    expect(paymentsEnabled({ NODE_ENV: 'production', PAYMENTS_ENABLED: 'true' })).toBe(true);
    expect(paymentsEnabled({ NODE_ENV: 'production', PAYMENTS_ENABLED: ' TRUE ' })).toBe(true);
    expect(paymentsEnabled({ NODE_ENV: 'test', PAYMENTS_ENABLED: 'false' })).toBe(false);
    expect(paymentsEnabled({ NODE_ENV: 'production', PAYMENTS_ENABLED: 'garbage' })).toBe(false);
  });
});
