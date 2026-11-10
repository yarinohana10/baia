'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { FlagChoice } from '@/hooks/admin/bulk-edit';

const CHOICES: FlagChoice[] = ['keep', 'yes', 'no'];

/** Three-way switch for a yes/no product setting: keep as is, yes for all, no for all. */
export function FlagChoiceField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: FlagChoice;
  onChange: (value: FlagChoice) => void;
}) {
  const t = useTranslations('admin.bulkEdit');
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <legend className="sr-only">{label}</legend>
      <div>
        <p className="text-sm font-medium" aria-hidden="true">
          {label}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="inline-flex shrink-0 rounded-md border border-border p-0.5" role="radiogroup" aria-label={label}>
        {CHOICES.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={value === choice}
            onClick={() => onChange(choice)}
            className={cn(
              'min-h-9 rounded px-3 text-xs font-medium transition-colors',
              value === choice ? 'bg-ocean-700 text-white' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t(`flag.${choice}`)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
