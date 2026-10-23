'use client';

import { useTranslations } from 'next-intl';
import { useAdminManagement } from '@/hooks/admin/useAdminManagement';
import { NoticeBanner } from '@/components/admin/common/NoticeBanner';
import { AddAdminForm } from '@/components/admin/admins/AddAdminForm';
import { AdminsList, InvitationsList } from '@/components/admin/admins/AdminsList';
import { RemoveAdminDialog } from '@/components/admin/admins/RemoveAdminDialog';

/** Who can sign in to the admin panel. Everyone sees the list; only the Owner can change it. */
export default function AdminAdminsPage() {
  const t = useTranslations('admin.admins');
  const m = useAdminManagement();

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {m.notice && <NoticeBanner notice={m.notice} onDismiss={m.dismissNotice} dismissLabel={t('dismiss')} />}

      {m.list.loaded && !m.canManage && (
        <p role="note" className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          {t('viewOnly')}
        </p>
      )}

      {m.canManage && <AddAdminForm submitting={m.adding} onSubmit={m.add} />}

      <section aria-labelledby="admins-heading" className="space-y-3">
        <h2 id="admins-heading" className="font-serif text-lg font-semibold text-foreground">
          {t('adminsHeading')}
        </h2>
        <AdminsList admins={m.admins} loading={m.list.loading} canManage={m.canManage} onRemove={m.askRemove} />
      </section>

      <section aria-labelledby="invitations-heading" className="space-y-3">
        <h2 id="invitations-heading" className="font-serif text-lg font-semibold text-foreground">
          {t('invitationsHeading')}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('invitationsHint')}</p>
        <InvitationsList invitations={m.invitations} canManage={m.canManage} onRevoke={m.revoke} />
      </section>

      {m.pendingRemoval && (
        <RemoveAdminDialog
          email={m.pendingRemoval.email}
          removing={m.removing}
          onConfirm={m.confirmRemoval}
          onClose={m.cancelRemove}
        />
      )}
    </div>
  );
}
