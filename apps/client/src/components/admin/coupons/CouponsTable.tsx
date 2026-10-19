'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { CouponRow } from './CouponRow';
import type { Coupon } from './types';

const COLUMNS = ['code', 'discount', 'minCart', 'usage', 'expires', 'status'] as const;
const TH = 'px-4 py-3 font-medium text-muted-foreground';

type Props = {
  coupons: Coupon[];
  onToggleActive: (coupon: Coupon) => void;
  onEdit: (coupon: Coupon) => void;
  onDelete: (id: string) => void;
};

export function CouponsTable({ coupons, ...actions }: Props) {
  const t = useTranslations('admin.coupons');
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted border-b border-border">
            {COLUMNS.map((column) => (
              <th key={column} className={`text-start ${TH}`}>
                {t(column)}
              </th>
            ))}
            <th className={`text-end ${TH}`}>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {coupons.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                {t('noCoupons')}
              </td>
            </tr>
          ) : (
            coupons.map((c) => <CouponRow key={c.id} coupon={c} {...actions} />)
          )}
        </tbody>
      </table>
    </Card>
  );
}
