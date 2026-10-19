'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { adminSelectClassName } from '@/components/admin/common/select-class';
import type { CouponDraft } from '@/hooks/admin/coupon-editor';
import type { DiscountType } from './types';

type Props = {
  draft: CouponDraft;
  isEdit: boolean;
  submitting: boolean;
  onChange: (changes: Partial<CouponDraft>) => void;
  onSubmit: () => void;
  onClose: () => void;
};

/** Create / edit coupon card. */
export function CouponForm({ draft, isEdit, submitting, onChange, onSubmit, onClose }: Props) {
  const t = useTranslations('admin.coupons');
  const percentage = draft.discountType === 'PERCENTAGE';

  return (
    <Card className="mb-6">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="font-serif">{isEdit ? t('editCoupon') : t('newCoupon')}</CardTitle>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="text-muted-foreground" aria-label={t('closeForm')}>
            <X size={16} />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="coupon-code">{t('code')}</Label>
            <Input
              id="coupon-code"
              type="text"
              value={draft.code}
              onChange={(e) => onChange({ code: e.target.value.toUpperCase() })}
              maxLength={30}
              className="uppercase"
              placeholder="SUMMER25"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-discountType">{t('type')}</Label>
            <select
              id="coupon-discountType"
              value={draft.discountType}
              onChange={(e) => onChange({ discountType: e.target.value as DiscountType })}
              className={adminSelectClassName()}
            >
              <option value="PERCENTAGE">{t('percentage')}</option>
              <option value="FIXED">{t('fixedAmount')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-value">{`${t('value')} ${percentage ? '(%)' : '(₪)'}`}</Label>
            <Input
              id="coupon-value"
              type="number"
              min="0"
              step="0.01"
              value={draft.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder={percentage ? '25' : '50'}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="coupon-minCartValue">{t('minCartValue')}</Label>
            <Input
              id="coupon-minCartValue"
              type="number"
              min="0"
              step="0.01"
              value={draft.minCartValue}
              onChange={(e) => onChange({ minCartValue: e.target.value })}
              placeholder={t('optional')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-maxUses">{t('maxUses')}</Label>
            <Input
              id="coupon-maxUses"
              type="number"
              min="1"
              step="1"
              value={draft.maxUses}
              onChange={(e) => onChange({ maxUses: e.target.value })}
              placeholder={t('unlimited')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-expiresAt">{t('expires')}</Label>
            <Input
              id="coupon-expiresAt"
              type="date"
              value={draft.expiresAt}
              onChange={(e) => onChange({ expiresAt: e.target.value })}
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={onSubmit}
          disabled={!draft.code || !draft.value || submitting}
          className="bg-ocean-700 text-white hover:bg-ocean-800"
        >
          {isEdit ? t('update') : t('create')}
        </Button>
      </CardContent>
    </Card>
  );
}
