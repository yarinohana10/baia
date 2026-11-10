'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** Yes / No choice for a product setting (used inside a ticked BulkField). */
export function YesNoSwitch({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const t = useTranslations('admin.bulkEdit');
  return (
    <div className="inline-flex rounded-md border border-border p-0.5" role="radiogroup" aria-label={label}>
      {[true, false].map((option) => (
        <button
          key={String(option)}
          type="button"
          role="radio"
          aria-checked={value === option}
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            'min-h-9 min-w-16 rounded px-4 text-xs font-medium transition-colors',
            value === option ? 'bg-ocean-700 text-white' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {t(option ? 'yes' : 'no')}
        </button>
      ))}
    </div>
  );
}
