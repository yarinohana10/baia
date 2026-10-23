'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Crown, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatAdminDate } from '@/lib/admin/format';
import type { AdminInvitation, AdminMember } from './types';

const TH = 'text-start px-4 py-3 font-medium text-muted-foreground';

/** Current admins; only the Owner (`canManage`) gets a remove control, and never for the Owner row. */
export function AdminsList({
  admins,
  loading,
  canManage,
  onRemove,
}: {
  admins: AdminMember[];
  loading: boolean;
  canManage: boolean;
  onRemove: (admin: AdminMember) => void;
}) {
  const t = useTranslations('admin.admins');
  const locale = useLocale();

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm" aria-busy={loading}>
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className={TH}>{t('admin')}</th>
              <th className={TH}>{t('since')}</th>
              {canManage && (
                <th className={TH}>
                  <span className="sr-only">{t('actions')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 3 : 2} className="px-4 py-8 text-center text-muted-foreground">
                  {loading ? '…' : t('noAdmins')}
                </td>
              </tr>
            ) : (
              admins.map((a) => (
                <tr key={a.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{a.name || a.email.split('@')[0]}</span>
                      {a.isOwner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          <Crown size={11} aria-hidden="true" />
                          {t('owner')}
                        </span>
                      )}
                    </div>
                    <span dir="ltr" className="text-xs text-muted-foreground">
                      {a.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatAdminDate(a.createdAt, locale, 'medium')}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-end">
                      {!a.isOwner && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemove(a)}
                          className="gap-1.5 text-destructive hover:bg-red-50"
                          aria-label={t('removeAria', { email: a.email })}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          {t('remove')}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Pending Admin Invitations: emails that become admins once they register and verify. */
export function InvitationsList({
  invitations,
  canManage,
  onRevoke,
}: {
  invitations: AdminInvitation[];
  canManage: boolean;
  onRevoke: (invitation: AdminInvitation) => void;
}) {
  const t = useTranslations('admin.admins');
  const locale = useLocale();

  if (invitations.length === 0) {
    return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t('noInvitations')}</p>;
  }

  return (
    <Card className="p-0">
      <ul className="divide-y divide-border">
        {invitations.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <span dir="ltr" className="text-sm font-medium text-foreground">
                {i.email}
              </span>
              <p className="text-xs text-muted-foreground">
                {t('invitedBy', { email: i.invitedByEmail })} · {formatAdminDate(i.createdAt, locale, 'medium')}
              </p>
            </div>
            {canManage && (
              <Button type="button" variant="outline" size="sm" onClick={() => onRevoke(i)} aria-label={t('revokeAria', { email: i.email })}>
                {t('revoke')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
