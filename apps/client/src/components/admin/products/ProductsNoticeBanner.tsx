'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProductsNotice } from './types';

const KIND_CLASS: Record<ProductsNotice['kind'], string> = {
  error: 'bg-red-50 text-red-700',
  info: 'bg-amber-50 text-amber-800',
  success: 'bg-emerald-50 text-emerald-700',
};

/** Dismissible result banner of the products list (its own palette). */
export function ProductsNoticeBanner({
  notice,
  onDismiss,
  dismissLabel,
}: {
  notice: ProductsNotice;
  onDismiss: () => void;
  dismissLabel: string;
}) {
  return (
    <div
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={cn('mb-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3 font-body text-sm', KIND_CLASS[notice.kind])}
    >
      <span>{notice.text}</span>
      <button type="button" onClick={onDismiss} className="rounded p-1 opacity-70 hover:opacity-100" aria-label={dismissLabel}>
        <X size={14} />
      </button>
    </div>
  );
}
