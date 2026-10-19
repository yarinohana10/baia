'use client';

import { useTranslations } from 'next-intl';
import type { FieldIssue } from '@baia/shared';
import { fieldMessage } from '@/lib/form-errors';
import { cn } from '@/lib/utils';

/** A field's translated validation message (from a shared Zod schema), or nothing. */
export function FieldError({ id, issue, className }: { id: string; issue?: FieldIssue; className?: string }) {
  const t = useTranslations();
  const message = fieldMessage(issue, (key, values) => t(key, values));
  if (!message) return null;
  return (
    // A <span>, not a <p>: content pages style their paragraphs (`[&_p]:…`), which must not restyle errors.
    <span id={id} role="alert" className={cn('mt-1 block text-xs font-normal text-red-600', className)}>
      {message}
    </span>
  );
}
