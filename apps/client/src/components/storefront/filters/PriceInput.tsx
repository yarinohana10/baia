'use client';

import { priceInputValue } from '@/lib/catalog/filter-options';

type PriceInputProps = {
  label: string;
  ariaLabel: string;
  value: string;
  placeholder: number | undefined;
  onChange: (value: string) => void;
};

/** One labelled ₪ amount input of the price filter. */
export function PriceInput({ label, ariaLabel, value, placeholder, onChange }: PriceInputProps) {
  return (
    <label className="flex-1 text-xs text-gray-600">
      {label}
      <span className="mt-1 flex h-10 items-center rounded-none border border-gray-300 px-2.5 focus-within:border-neutral-700">
        <span aria-hidden="true" className="text-gray-400">₪</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          placeholder={priceInputValue(placeholder)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          className="w-full bg-transparent px-1 text-sm text-charcoal outline-none"
        />
      </span>
    </label>
  );
}
