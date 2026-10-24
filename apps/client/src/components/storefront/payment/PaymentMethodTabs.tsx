'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, Smartphone, Wallet } from 'lucide-react';
import type { PaymentMethod } from '@/lib/payment';
import { cn } from '@/lib/utils';

const PAYMENT_TABS: { key: PaymentMethod; icon: ReactNode }[] = [
  { key: 'card', icon: <CreditCard size={16} aria-hidden="true" /> },
  { key: 'bit', icon: <Smartphone size={16} aria-hidden="true" /> },
  { key: 'apple_pay', icon: <Wallet size={16} aria-hidden="true" /> },
];

export const tabId = (method: PaymentMethod) => `pay-tab-${method}`;
export const panelId = (method: PaymentMethod) => `pay-panel-${method}`;

/** Card / Bit / Apple Pay tabs (only the methods the provider offers); arrow keys move between them. */
export function PaymentMethodTabs({
  methods,
  selected,
  disabled,
  onSelect,
  onMove,
}: {
  methods: PaymentMethod[];
  selected: PaymentMethod;
  disabled: boolean;
  onSelect: (method: PaymentMethod) => void;
  onMove: (method: PaymentMethod) => void;
}) {
  const t = useTranslations('payment');
  const tabs = PAYMENT_TABS.filter((tab) => methods.includes(tab.key));

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const idx = tabs.findIndex((x) => x.key === selected);
    // Visual order follows the document direction (RTL in Hebrew).
    const forward = (e.key === 'ArrowLeft') === (document.dir === 'rtl');
    const next = tabs[(idx + (forward ? 1 : tabs.length - 1)) % tabs.length];
    onMove(next.key);
    document.getElementById(tabId(next.key))?.focus();
  };

  return (
    <div role="tablist" aria-label={t('methodsLabel')} className="grid grid-cols-3 gap-2 mb-6">
      {tabs.map((tab) => {
        const isSelected = selected === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={tabId(tab.key)}
            aria-selected={isSelected}
            aria-controls={panelId(tab.key)}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelect(tab.key)}
            onKeyDown={onKeyDown}
            className={cn(
              'flex items-center justify-center gap-2 rounded-none border px-2 py-2.5 text-sm transition-colors disabled:opacity-50',
              isSelected
                ? 'border-black bg-[#F7F7F7] text-black font-medium'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            {tab.icon}
            {t(`methods.${tab.key}`)}
          </button>
        );
      })}
    </div>
  );
}
