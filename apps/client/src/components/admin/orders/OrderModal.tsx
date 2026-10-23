'use client';

import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Centered modal for the orders screen: focus is trapped, Escape and a click on the
 * backdrop close it, and focus returns to what opened it. Render it only while it is shown.
 */
export function OrderModal({
  title,
  description,
  onClose,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations('admin.orders');
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            'fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[85dvh] max-w-lg -translate-y-1/2 overflow-y-auto rounded-xl bg-card p-5 text-card-foreground shadow-xl outline-none',
            className,
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Dialog.Title className="font-serif text-lg font-semibold">{title}</Dialog.Title>
              {description && <Dialog.Description className="text-sm text-muted-foreground">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label={t('close')}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X size={16} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
