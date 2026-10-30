'use client';

import { useEffect, useReducer, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { useAdminList } from '@/hooks/admin/useAdminList';
import { useFilePreview } from '@/hooks/admin/useFilePreview';
import type { ListPage } from '@/hooks/admin/admin-list';
import { CLOSED_CATEGORY_EDITOR, categoryEditorReducer, categoryPayload } from '@/hooks/admin/category-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormFeedback, type Feedback } from '@/components/admin/common/FormFeedback';
import { CategoryForm } from '@/components/admin/categories/CategoryForm';
import { CategoryRow } from '@/components/admin/categories/CategoryRow';
import { deleteErrorKey, saveErrorKey, type Category, type SizeGuideOption, type SizeSetOption } from '@/components/admin/categories/types';

const selectCategories = (data: Category[]): ListPage<Category> => ({
  items: data,
  total: data.length,
  totalPages: 1,
  meta: undefined,
});

/** Uploads the category image; it needs the saved category's id. Resolves to false on failure. */
async function uploadCategoryImage(categoryId: string, file: File): Promise<boolean> {
  try {
    const form = new FormData();
    form.append('file', file, file.name);
    await api.post(`/admin/categories/${categoryId}/image`, form);
    return true;
  } catch {
    return false;
  }
}

export default function CategoriesPage() {
  const t = useTranslations('admin.categories');
  const list = useAdminList({ url: '/categories', select: selectCategories });
  const [editor, dispatch] = useReducer(categoryEditorReducer, CLOSED_CATEGORY_EDITOR);
  const [sizeSets, setSizeSets] = useState<SizeSetOption[]>([]);
  const [sizeGuides, setSizeGuides] = useState<SizeGuideOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Feedback | null>(null);
  // Image chosen in the form; uploaded after the category is saved.
  const image = useFilePreview();
  const feedback: Feedback | null = list.error ? { type: 'error', text: t('loadFailed') } : message;

  useEffect(() => {
    let cancelled = false;
    api.get<SizeSetOption[]>('/size-sets').then(
      (res) => !cancelled && setSizeSets(res.data),
      () => !cancelled && setSizeSets([]),
    );
    api.get<SizeGuideOption[]>('/admin/size-guides').then(
      (res) => !cancelled && setSizeGuides(res.data),
      () => !cancelled && setSizeGuides([]),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const openForm = (action: { type: 'create' } | { type: 'edit'; category: Category }) => {
    image.setFile(null);
    dispatch(action);
  };

  const closeForm = () => {
    image.setFile(null);
    dispatch({ type: 'close' });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const { editing, draft } = editor;
    setSubmitting(true);
    setMessage(null);
    try {
      const data = categoryPayload(draft);
      const saved = editing
        ? await api.put(`/admin/categories/${editing.id}`, data)
        : await api.post('/admin/categories', data);
      const imageSaved = !image.file || (await uploadCategoryImage(saved.data.id, image.file));
      setMessage(
        imageSaved
          ? { type: 'success', text: t(editing ? 'updatedSuccess' : 'createdSuccess') }
          : { type: 'error', text: t('imageFailed') },
      );
      closeForm();
      list.reload();
      await revalidateCatalog();
    } catch (err) {
      setMessage({ type: 'error', text: t(saveErrorKey(err)) });
    } finally {
      setSubmitting(false);
    }
  };

  const removeImage = async () => {
    const { editing } = editor;
    if (!editing?.image || !confirm(t('removeImageConfirm'))) return;
    try {
      await api.delete(`/admin/categories/${editing.id}/image`);
      dispatch({ type: 'imageRemoved' });
      setMessage({ type: 'success', text: t('imageRemoved') });
      list.reload();
      await revalidateCatalog();
    } catch {
      setMessage({ type: 'error', text: t('saveFailed') });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    setMessage(null);
    try {
      await api.delete(`/admin/categories/${id}`);
      setMessage({ type: 'success', text: t('deletedSuccess') });
      dispatch({ type: 'deleted', id });
      list.reload();
      await revalidateCatalog();
    } catch (err) {
      setMessage({ type: 'error', text: t(deleteErrorKey(err)) });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <Button onClick={() => openForm({ type: 'create' })} className="gap-2 bg-ocean-700 text-white hover:bg-ocean-800">
          <Plus size={16} /> {t('addCategory')}
        </Button>
      </div>

      {feedback && <FormFeedback feedback={feedback} />}

      {editor.open && (
        <CategoryForm
          draft={editor.draft}
          editing={editor.editing}
          categories={list.items}
          sizeSets={sizeSets}
          sizeGuides={sizeGuides}
          submitting={submitting}
          image={{
            hasPendingFile: !!image.file,
            previewUrl: image.previewUrl,
            onPick: image.setFile,
            onRemoveSaved: removeImage,
          }}
          onChange={(changes) => dispatch({ type: 'change', changes })}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}

      <Card className="overflow-hidden p-0">
        {list.items.length === 0 ? (
          <p className="p-6 text-muted-foreground text-center">{t('noCategories')}</p>
        ) : (
          list.items.map((cat) => (
            <CategoryRow key={cat.id} category={cat} onEdit={(category) => openForm({ type: 'edit', category })} onDelete={handleDelete} />
          ))
        )}
      </Card>
    </div>
  );
}
