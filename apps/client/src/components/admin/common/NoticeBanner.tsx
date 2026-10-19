'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Notice = { kind: 'success' | 'error'; text: string };

/** Dismissible success / error banner at the top of an admin page. */
export function NoticeBanner({
  notice,
  onDismiss,
  dismissLabel,
  className,
}: {
  notice: Notice;
  onDismiss: () => void;
  dismissLabel: string;
  className?: string;
}) {
  return (
    <div
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm',
        notice.kind === 'error' ? 'bg-red-50 text-destructive' : 'bg-green-50 text-green-700',
        className,
      )}
    >
      <span>{notice.text}</span>
      <button type="button" onClick={onDismiss} className="rounded p-1 opacity-70 hover:opacity-100" aria-label={dismissLabel}>
        <X size={14} />
      </button>
    </div>
  );
}
