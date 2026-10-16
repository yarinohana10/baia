import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/**
 * Stable, machine-readable codes for errors a shopper can see. The client
 * translates `code`; `message` stays English for logs and API users.
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
  | 'ADDRESS_LIMIT_REACHED';

type Extra = Record<string, string | number | null | undefined>;

const body = (status: number, error: string, code: ShopErrorCode, message: string, extra?: Extra) => ({
  statusCode: status,
  error,
  code,
  message,
  ...extra,
});

export const shopBadRequest = (code: ShopErrorCode, message: string, extra?: Extra) =>
  new BadRequestException(body(400, 'Bad Request', code, message, extra));

export const shopNotFound = (code: ShopErrorCode, message: string, extra?: Extra) =>
  new NotFoundException(body(404, 'Not Found', code, message, extra));

export const shopConflict = (code: ShopErrorCode, message: string, extra?: Extra) =>
  new ConflictException(body(409, 'Conflict', code, message, extra));
