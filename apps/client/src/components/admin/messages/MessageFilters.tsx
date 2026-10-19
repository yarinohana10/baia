'use client';

import { useTranslations } from 'next-intl';
import type { MessageFilter } from './types';

const FILTERS = [
  { key: 'ALL', label: 'filterAll' },
  { key: 'NEW', label: 'filterNew' },
  { key: 'HANDLED', label: 'filterHandled' },
] as const;

/** All / new / handled toggle for the inbox. */
export function MessageFilters({ value, onChange }: { value: MessageFilter; onChange: (filter: MessageFilter) => void }) {
  const t = useTranslations('admin.messages');
  return (
    <div role="group" className="inline-flex rounded-lg border border-border bg-background p-1">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={value === f.key}
          onClick={() => onChange(f.key)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            value === f.key ? 'bg-ocean-700 text-white' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t(f.label)}
        </button>
      ))}
    </div>
  );
}
