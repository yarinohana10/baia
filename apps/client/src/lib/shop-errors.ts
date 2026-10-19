import { isAxiosError } from 'axios';
import { formatPrice } from '@/lib/catalog/pricing';

/**
 * Shopper-facing API errors carry a stable `code` (see the server's
 * common/error-codes.ts). The UI never shows the server's English `message`;
 * it maps the code to a key in the `checkout.errors` namespace instead.
 */
export type ShopErrorCode =
  | 'CART_EMPTY'
  | 'VARIANT_UNAVAILABLE'
  | 'OUT_OF_STOCK'
  | 'COUPON_INVALID'
  | 'COUPON_INACTIVE'
  | 'COUPON_EXPIRED'
  | 'COUPON_LIMIT_REACHED'
  | 'COUPON_MIN_TOTAL'
  | 'ORDER_NOT_PAYABLE'
  | 'ADDRESS_LIMIT_REACHED'
  | 'ADDRESS_REQUIRED'
  | 'PICKUP_POINT_UNAVAILABLE'
  | 'ORDER_LOOKUP_FAILED'
  | 'SELF_CANCEL_UNAVAILABLE'
  | 'CANCELLATION_NOT_ALLOWED'
  | 'CANCELLATION_ALREADY_REQUESTED';

type ErrorBody = {
  code?: string;
  productNameHe?: string | null;
  productNameEn?: string | null;
  size?: string | null;
  available?: number | null;
  minCartValue?: number | null;
};

/** A translation key under `checkout.errors` plus its ICU values. */
export type ErrorMessage = { key: string; values?: Record<string, string | number> };

export function errorStatus(err: unknown): number | null {
  return isAxiosError(err) ? (err.response?.status ?? null) : null;
}

export function errorCode(err: unknown): ShopErrorCode | null {
  if (!isAxiosError(err)) return null;
  const data = err.response?.data as ErrorBody | undefined;
  return typeof data?.code === 'string' ? (data.code as ShopErrorCode) : null;
}

function productName(body: ErrorBody, locale: string): string | null {
  const he = body.productNameHe || null;
  const en = body.productNameEn || null;
  return locale === 'he' ? (he ?? en) : (en ?? he);
}

export function shopErrorMessage(err: unknown, locale: string): ErrorMessage {
  if (!isAxiosError(err)) return { key: 'generic' };
  if (!err.response) return { key: 'network' };

  const status = err.response.status;
  const body = (err.response.data ?? {}) as ErrorBody;
  const product = productName(body, locale);
  const size = body.size ?? '';

  switch (body.code) {
    case 'CART_EMPTY':
      return { key: 'cartEmpty' };
    case 'VARIANT_UNAVAILABLE':
      return product ? { key: 'variantUnavailable', values: { product, size } } : { key: 'variantUnavailableGeneric' };
    case 'OUT_OF_STOCK':
      if (product) return { key: 'outOfStock', values: { product, size } };
      if (typeof body.available === 'number' && body.available > 0) {
        return { key: 'outOfStockAvailable', values: { available: body.available } };
      }
      return { key: 'outOfStockGeneric' };
    case 'COUPON_INVALID':
      return { key: 'couponInvalid' };
    case 'COUPON_INACTIVE':
      return { key: 'couponInactive' };
    case 'COUPON_EXPIRED':
      return { key: 'couponExpired' };
    case 'COUPON_LIMIT_REACHED':
      return { key: 'couponLimitReached' };
    case 'COUPON_MIN_TOTAL':
      return typeof body.minCartValue === 'number'
        ? { key: 'couponMinTotal', values: { min: formatPrice(body.minCartValue) } }
        : { key: 'couponInvalid' };
    case 'ORDER_NOT_PAYABLE':
      return { key: 'orderNotPayable' };
    case 'ADDRESS_REQUIRED':
      return { key: 'addressRequired' };
    case 'PICKUP_POINT_UNAVAILABLE':
      return { key: 'pickupPointUnavailable' };
    case 'ORDER_LOOKUP_FAILED':
      return { key: 'orderLookupFailed' };
    case 'SELF_CANCEL_UNAVAILABLE':
      return { key: 'selfCancelUnavailable' };
    case 'CANCELLATION_NOT_ALLOWED':
      return { key: 'cancellationNotAllowed' };
    case 'CANCELLATION_ALREADY_REQUESTED':
      return { key: 'cancellationAlreadyRequested' };
  }

  if (status === 429) return { key: 'tooManyRequests' };
  if (status === 402) return { key: 'paymentDeclined' };
  if (status === 400) return { key: 'invalidDetails' };
  return { key: 'generic' };
}
