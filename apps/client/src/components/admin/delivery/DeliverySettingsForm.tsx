'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { deliverySettingsSchema } from '@baia/shared';
import { api } from '@/lib/api';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { validateForm, type FieldIssues } from '@/lib/form-errors';
import { Button } from '@/components/ui/button';
import type { Notice } from '@/components/admin/common/NoticeBanner';
import { DeliverySettingField } from './DeliverySettingField';
import { settingsForValidation, type DeliverySettings } from './types';

type Props = {
  settings: DeliverySettings;
  onChange: (field: keyof DeliverySettings, value: string) => void;
  onNotice: (notice: Notice | null) => void;
};

/** Delivery prices, ETAs and the self-cancel window, validated live with the shared schema. */
export function DeliverySettingsForm({ settings, onChange, onNotice }: Props) {
  const t = useTranslations('admin.delivery');
  const [saving, setSaving] = useState(false);
  // The shared schema also converts the form strings to the API's numbers.
  const check = validateForm(deliverySettingsSchema, settingsForValidation(settings));
  const issues: FieldIssues = check.errors;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!check.success || saving) return;
    setSaving(true);
    onNotice(null);
    try {
      await api.put('/admin/site-config', check.data);
      await revalidateCatalog();
      onNotice({ kind: 'success', text: t('saved') });
    } catch {
      onNotice({ kind: 'error', text: t('saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof DeliverySettings, label: string, extra: { hint?: string; suffix?: string }) => (
    <DeliverySettingField field={key} label={label} value={settings[key]} issue={issues[key]} onChange={onChange} {...extra} />
  );

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {field('shippingCost', t('courierPrice'), { suffix: '₪' })}
        {field('pickupPointCost', t('pickupPrice'), { suffix: '₪' })}
        {field('freeShippingThreshold', t('freeThreshold'), { suffix: '₪', hint: t('freeThresholdHint') })}
        {field('courierEtaDays', t('courierEta'), { suffix: t('days'), hint: t('etaHint') })}
        {field('pickupEtaDays', t('pickupEta'), { suffix: t('days'), hint: t('etaHint') })}
        {field('selfCancelWindowHours', t('cancelWindow'), { suffix: t('hours'), hint: t('cancelWindowHint') })}
      </div>
      {!check.success && <p className="text-sm text-destructive">{t('invalid')}</p>}
      <Button type="submit" disabled={saving || !check.success} className="bg-ocean-700 text-white hover:bg-ocean-800">
        {saving ? t('saving') : t('save')}
      </Button>
    </form>
  );
}
