'use client';

import { useTranslations } from 'next-intl';
import { isExpired, isMaxedOut, type Coupon } from './types';

const BADGE = 'text-xs px-2 py-0.5 rounded-full';

/** Expired, used up, active or inactive — in that order of precedence. */
export function CouponStatusBadge({ coupon }: { coupon: Coupon }) {
  const t = useTranslations('admin.coupons');
  if (isExpired(coupon)) return <span className={`${BADGE} bg-red-50 text-destructive`}>{t('expired')}</span>;
  if (isMaxedOut(coupon)) return <span className={`${BADGE} bg-orange-50 text-orange-500`}>{t('maxed')}</span>;
  if (coupon.isActive) return <span className={`${BADGE} bg-green-50 text-green-600`}>{t('active')}</span>;
  return <span className={`${BADGE} bg-muted text-muted-foreground`}>{t('inactive')}</span>;
}
