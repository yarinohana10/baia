'use client';

import { useTranslations } from 'next-intl';

type Props = { checked: boolean; onChange: (value: boolean) => void };

/** "In stock only" switch. */
export function InStockToggle({ checked, onChange }: Props) {
  const t = useTranslations('filters');
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-[12px] uppercase ltr:tracking-[0.12em] text-black">
      <span className="relative inline-flex">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="h-6 w-10 rounded-full bg-gray-300 transition-colors peer-checked:bg-black peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-neutral-700"
        />
        <span
          aria-hidden="true"
          className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ltr:peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4"
        />
      </span>
      {t('inStock')}
    </label>
  );
}
