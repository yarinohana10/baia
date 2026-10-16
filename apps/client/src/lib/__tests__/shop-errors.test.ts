import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { errorCode, shopErrorMessage } from '../shop-errors';

function apiError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: {},
  } as AxiosResponse);
}

describe('shopErrorMessage', () => {
  const outOfStock = apiError(400, {
    code: 'OUT_OF_STOCK',
    message: 'Insufficient stock for Wave (Blue/M)',
    productNameHe: 'גל',
    productNameEn: 'Wave',
    size: 'M',
  });

  it('uses the product name for the shopper’s locale', () => {
    expect(shopErrorMessage(outOfStock, 'he')).toEqual({ key: 'outOfStock', values: { product: 'גל', size: 'M' } });
    expect(shopErrorMessage(outOfStock, 'en')).toEqual({ key: 'outOfStock', values: { product: 'Wave', size: 'M' } });
    expect(errorCode(outOfStock)).toBe('OUT_OF_STOCK');
  });

  it('uses the available count from cart endpoints', () => {
    expect(shopErrorMessage(apiError(400, { code: 'OUT_OF_STOCK', available: 2 }), 'en')).toEqual({
      key: 'outOfStockAvailable',
      values: { available: 2 },
    });
    expect(shopErrorMessage(apiError(400, { code: 'OUT_OF_STOCK', available: null }), 'en')).toEqual({
      key: 'outOfStockGeneric',
    });
  });

  it('maps coupon and payment codes', () => {
    expect(shopErrorMessage(apiError(400, { code: 'COUPON_MIN_TOTAL', minCartValue: 200 }), 'he')).toEqual({
      key: 'couponMinTotal',
      values: { min: '₪200' },
    });
    expect(shopErrorMessage(apiError(404, { code: 'COUPON_INVALID' }), 'he').key).toBe('couponInvalid');
    expect(shopErrorMessage(apiError(409, { code: 'ORDER_NOT_PAYABLE' }), 'he').key).toBe('orderNotPayable');
  });

  it('never surfaces raw server messages', () => {
    expect(shopErrorMessage(apiError(400, { message: ['phone must be a valid phone number'] }), 'he').key).toBe(
      'invalidDetails',
    );
    expect(shopErrorMessage(apiError(402, { message: 'Payment was declined' }), 'he').key).toBe('paymentDeclined');
    expect(shopErrorMessage(apiError(429, {}), 'he').key).toBe('tooManyRequests');
    expect(shopErrorMessage(apiError(500, { message: 'boom' }), 'he').key).toBe('generic');
    expect(shopErrorMessage(new Error('x'), 'he').key).toBe('generic');
    expect(shopErrorMessage(new AxiosError('Network Error'), 'he').key).toBe('network');
  });
});
