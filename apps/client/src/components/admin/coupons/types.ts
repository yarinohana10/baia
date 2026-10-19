import { isAxiosError } from 'axios';
import { toStoreDay } from '@/lib/admin/format';

export type DiscountType = 'PERCENTAGE' | 'FIXED';

export type Coupon = {
  id: string;
  code: string;
  discountType: DiscountType;
  value: string;
  minCartValue: string | null;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  expiresAt: string | null;
  _count: { orders: number };
};

/** Expiry as `MM/DD/YYYY` of the Israel calendar day it is stored for. */
export function formatCouponDate(dateStr: string) {
  const [year, month, day] = toStoreDay(dateStr).split('-');
  return `${month}/${day}/${year}`;
}

export function isExpired(c: Coupon) {
  return c.expiresAt !== null && new Date(c.expiresAt) < new Date();
}

export function isMaxedOut(c: Coupon) {
  return c.maxUses !== null && c.currentUses >= c.maxUses;
}

type ApiFieldError = { field: string; code: string };

export type CouponErrorKey =
  | 'duplicateCode'
  | 'invalidCode'
  | 'invalidPercentage'
  | 'invalidFixedValue'
  | 'invalidMinCart'
  | 'invalidMaxUses'
  | 'invalidExpiry'
  | 'saveFailed';

/** Translation key for a failed save, from the API's field errors. */
export function couponErrorKey(err: unknown, discountType: DiscountType): CouponErrorKey {
  if (!isAxiosError(err)) return 'saveFailed';
  if (err.response?.status === 409) return 'duplicateCode';
  const errors: ApiFieldError[] = err.response?.data?.errors ?? [];
  const fields = new Set(errors.map((e) => e.field));
  if (fields.has('code')) return 'invalidCode';
  if (fields.has('value')) return discountType === 'PERCENTAGE' ? 'invalidPercentage' : 'invalidFixedValue';
  if (fields.has('minCartValue')) return 'invalidMinCart';
  if (fields.has('maxUses')) return 'invalidMaxUses';
  if (fields.has('expiresAt')) return 'invalidExpiry';
  return 'saveFailed';
}
