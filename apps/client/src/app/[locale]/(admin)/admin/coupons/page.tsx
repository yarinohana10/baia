'use client';

import { useReducer, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAdminList } from '@/hooks/admin/useAdminList';
import type { ListPage } from '@/hooks/admin/admin-list';
import { CLOSED_COUPON_EDITOR, couponEditorReducer, couponPayload } from '@/hooks/admin/coupon-editor';
import { Button } from '@/components/ui/button';
import { FormFeedback, type Feedback } from '@/components/admin/common/FormFeedback';
import { CouponForm } from '@/components/admin/coupons/CouponForm';
import { CouponsTable } from '@/components/admin/coupons/CouponsTable';
import { couponErrorKey, type Coupon } from '@/components/admin/coupons/types';

const selectCoupons = (data: Coupon[]): ListPage<Coupon> => ({
  items: data,
  total: data.length,
  totalPages: 1,
  meta: undefined,
});

export default function CouponsPage() {
  const t = useTranslations('admin.coupons');
  const list = useAdminList({ url: '/admin/coupons', select: selectCoupons });
  const [editor, dispatch] = useReducer(couponEditorReducer, CLOSED_COUPON_EDITOR);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Feedback | null>(null);
  const feedback: Feedback | null = list.error ? { type: 'error', text: t('loadFailed') } : message;

  const handleSubmit = async () => {
    if (submitting) return;
    const { editing, draft } = editor;
    setSubmitting(true);
    setMessage(null);
    try {
      const payload = couponPayload(draft);
      if (editing) await api.put(`/admin/coupons/${editing.id}`, payload);
      else await api.post('/admin/coupons', payload);
      setMessage({ type: 'success', text: t(editing ? 'updatedSuccess' : 'createdSuccess') });
      dispatch({ type: 'close' });
      list.reload();
    } catch (err) {
      setMessage({ type: 'error', text: t(couponErrorKey(err, draft.discountType)) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    setMessage(null);
    try {
      const res = await api.delete<{ deleted: boolean; deactivated?: boolean }>(`/admin/coupons/${id}`);
      setMessage({ type: 'success', text: t(res.data.deactivated ? 'deactivatedInstead' : 'deletedSuccess') });
      if (editor.editing?.id === id) dispatch({ type: 'close' });
    } catch {
      setMessage({ type: 'error', text: t('deleteFailed') });
    }
    list.reload();
  };

  const toggleActive = async (c: Coupon) => {
    setMessage(null);
    try {
      await api.put(`/admin/coupons/${c.id}`, { isActive: !c.isActive });
    } catch {
      setMessage({ type: 'error', text: t('saveFailed') });
    }
    list.reload();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <Button onClick={() => dispatch({ type: 'create' })} className="gap-2 bg-ocean-700 text-white hover:bg-ocean-800">
          <Plus size={16} /> {t('createCoupon')}
        </Button>
      </div>

      {feedback && <FormFeedback feedback={feedback} />}

      {editor.open && (
        <CouponForm
          draft={editor.draft}
          isEdit={!!editor.editing}
          submitting={submitting}
          onChange={(changes) => dispatch({ type: 'change', changes })}
          onSubmit={handleSubmit}
          onClose={() => dispatch({ type: 'close' })}
        />
      )}

      <CouponsTable
        coupons={list.items}
        onToggleActive={toggleActive}
        onEdit={(coupon) => dispatch({ type: 'edit', coupon })}
        onDelete={handleDelete}
      />
    </div>
  );
}
