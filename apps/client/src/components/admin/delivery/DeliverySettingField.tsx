'use client';

import type { FieldIssue } from '@/lib/form-errors';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/forms/FieldError';
import type { DeliverySettings } from './types';

type Props = {
  field: keyof DeliverySettings;
  label: string;
  value: string;
  issue: FieldIssue | undefined;
  onChange: (field: keyof DeliverySettings, value: string) => void;
  hint?: string;
  suffix?: string;
};

/** One delivery setting input with its unit suffix, error and hint. */
export function DeliverySettingField({ field, label, value, issue, onChange, hint, suffix }: Props) {
  const id = `delivery-${field}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {/* LTR wrapper so the suffix sits on the same side as the input's end padding. */}
      <div className="relative" dir="ltr">
        <Input
          id={id}
          dir="ltr"
          inputMode={field.endsWith('EtaDays') ? 'text' : 'decimal'}
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          aria-invalid={!!issue}
          aria-describedby={issue ? `${id}-error` : undefined}
          className={cn(suffix && 'pe-14')}
        />
        {suffix && (
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      <FieldError id={`${id}-error`} issue={issue} className="text-destructive" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
