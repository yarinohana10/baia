'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useModalDialog } from '@/hooks/storefront/useModalDialog';

/** Confirmation before an admin loses access (they are signed out immediately). */
export function RemoveAdminDialog({
  email,
  removing,
  onConfirm,
  onClose,
}: {
  email: string;
  removing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('admin.admins');
  const titleId = useId();
  const dialog = useModalDialog(onClose);

  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-center justify-center bg-black/30 p-4 text-inherit backdrop:bg-transparent open:flex"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-start shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          {t('removeTitle')}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {t('removeBody', { email })}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={removing}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={removing} className="bg-destructive text-white hover:bg-destructive/90">
            {removing ? t('removing') : t('confirmRemove')}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
