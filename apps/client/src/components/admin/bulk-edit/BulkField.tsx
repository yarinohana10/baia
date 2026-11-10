'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  /** Shown under the input while the field is marked to change. */
  hint?: string;
  children: ReactNode;
};

/** One bulk-editable field: a "change this" checkbox; the input only applies when it is ticked. */
export function BulkField({ id, label, enabled, onToggle, hint, children }: Props) {
  return (
    <div className={cn('rounded-lg border p-3 transition-colors', enabled ? 'border-ocean-300 bg-ocean-50/40' : 'border-border')}>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          aria-controls={id}
          className="size-4 accent-ocean-700"
        />
        {label}
      </label>
      <div id={id} className={cn('mt-2', !enabled && 'pointer-events-none opacity-45')} aria-disabled={!enabled}>
        {children}
      </div>
      {enabled && hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
