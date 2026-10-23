'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Notice } from '@/components/admin/common/NoticeBanner';
import type { AddAdminResponse, AdminInvitation, AdminMember, AdminUsersResponse } from '@/components/admin/admins/types';
import type { ListPage } from './admin-list';
import { useAdminList } from './useAdminList';

type AdminsMeta = { invitations: AdminInvitation[]; canManage: boolean };

const selectAdmins = (data: AdminUsersResponse): ListPage<AdminMember, AdminsMeta> => ({
  items: data.admins,
  total: data.admins.length,
  totalPages: 1,
  meta: { invitations: data.invitations, canManage: data.canManage },
});

/** Loads the admins + pending invitations and wraps the Owner-only add / remove / revoke calls. */
export function useAdminManagement() {
  const t = useTranslations('admin.admins');
  const locale = useLocale();
  const list = useAdminList({ url: '/admin/users', select: selectAdmins });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<AdminMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const fail = (key: string) => setNotice({ kind: 'error', text: t(key) });

  const add = async (email: string): Promise<boolean> => {
    setAdding(true);
    setNotice(null);
    try {
      const { data } = await api.post<AddAdminResponse>('/admin/users', { email }, { headers: { 'x-locale': locale } });
      setNotice({ kind: 'success', text: t(`added.${data.action}`, { email: data.email }) });
      list.reload();
      return true;
    } catch {
      fail('addFailed');
      return false;
    } finally {
      setAdding(false);
    }
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    setRemoving(true);
    setNotice(null);
    try {
      await api.delete(`/admin/users/${pendingRemoval.id}`);
      setNotice({ kind: 'success', text: t('removedSuccess', { email: pendingRemoval.email }) });
    } catch {
      fail('removeFailed');
    } finally {
      setRemoving(false);
      setPendingRemoval(null);
      list.reload();
    }
  };

  const revoke = async (invitation: AdminInvitation) => {
    setNotice(null);
    try {
      await api.delete(`/admin/users/invitations/${invitation.id}`);
      setNotice({ kind: 'success', text: t('revokedSuccess', { email: invitation.email }) });
    } catch {
      fail('revokeFailed');
    }
    list.reload();
  };

  return {
    list,
    admins: list.items,
    invitations: list.meta?.invitations ?? [],
    canManage: list.meta?.canManage ?? false,
    notice: list.error ? ({ kind: 'error', text: t('loadFailed') } satisfies Notice) : notice,
    dismissNotice: () => {
      setNotice(null);
      list.dismissError();
    },
    adding,
    add,
    pendingRemoval,
    askRemove: setPendingRemoval,
    cancelRemove: () => setPendingRemoval(null),
    removing,
    confirmRemoval,
    revoke,
  };
}
