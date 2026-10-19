'use client';

import { useTranslations } from 'next-intl';
import type { CancellationInfo } from '@/lib/orders';
import { cn } from '@/lib/utils';
import { SelfCancelWindow } from './SelfCancelWindow';

const CHOICES = [true, false] as const;

/** Step 2 of the public form: the free window and, when both are allowed, cancel now vs. ask us to call. */
export function CancelModeChoice({
  info,
  unpaid,
  instant,
  onChange,
}: {
  info: CancellationInfo;
  unpaid: boolean;
  instant: boolean;
  onChange: (instant: boolean) => void;
}) {
  const t = useTranslations('cancelOrderPage');
  return (
    <fieldset className="space-y-3 rounded-xl border border-ocean-200 bg-ocean-50/50 p-4">
      <legend className="sr-only">{t('chooseLegend')}</legend>
      <SelfCancelWindow unpaid={unpaid} deadline={info.selfCancelDeadline} className="text-gray-700" />
      {info.canRequest ? (
        <div className="space-y-2">
          {CHOICES.map((value) => (
            <label
              key={String(value)}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 text-sm',
                instant === value ? 'border-ocean-600' : 'border-gray-200',
              )}
            >
              <input
                type="radio"
                name="cancel-mode"
                checked={instant === value}
                onChange={() => onChange(value)}
                className="mt-1 accent-ocean-700"
              />
              <span>
                <span className="block font-medium text-gray-900">{value ? t('instantTitle') : t('requestTitle')}</span>
                <span className="block text-xs text-gray-500">{value ? t('instantBody') : t('requestBody')}</span>
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
