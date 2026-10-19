'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { isAxiosError } from 'axios';
import { api } from '@/lib/api';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ImagePlus, X } from 'lucide-react';

type Category = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  sortOrder: number;
  parentId: string | null;
  sizeSetId?: string | null;
  image?: string | null;
  children: Category[];
};

type SizeSetOption = { id: string; nameHe: string; nameEn: string };

const EMPTY_FORM = { nameHe: '', nameEn: '', slug: '', parentId: '', sizeSetId: '', sortOrder: 0 };

function autoSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Feedback = { type: 'success' | 'error'; text: string };
type ApiFieldError = { field: string; code: string };

function apiErrors(err: unknown): { status?: number; codes: Set<string>; fields: Set<string> } {
  if (!isAxiosError(err)) return { codes: new Set(), fields: new Set() };
  const errors: ApiFieldError[] = err.response?.data?.errors ?? [];
  return {
    status: err.response?.status,
    codes: new Set(errors.map((e) => e.code)),
    fields: new Set(errors.map((e) => e.field)),
  };
}

type SaveErrorKey =
  | 'parentHasProducts'
  | 'duplicateSlug'
  | 'invalidSlug'
  | 'invalidParent'
  | 'parentNotTopLevel'
  | 'cannotNestWithChildren'
  | 'saveFailed';

function saveErrorKey(err: unknown): SaveErrorKey {
  const { codes, fields } = apiErrors(err);
  if (codes.has('parentHasProducts')) return 'parentHasProducts';
  if (fields.has('slug')) return codes.has('unique') ? 'duplicateSlug' : 'invalidSlug';
  if (codes.has('selfParent') || codes.has('descendantParent') || codes.has('notFound')) return 'invalidParent';
  if (codes.has('maxDepth')) return 'parentNotTopLevel';
  if (codes.has('hasSubcategories')) return 'cannotNestWithChildren';
  return 'saveFailed';
}

function deleteErrorKey(err: unknown): 'deleteHasProducts' | 'deleteHasChildren' | 'deleteFailed' {
  const { codes } = apiErrors(err);
  if (codes.has('hasProducts')) return 'deleteHasProducts';
  if (codes.has('hasSubcategories')) return 'deleteHasChildren';
  return 'deleteFailed';
}

function selectClassName() {
  return cn(
    'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  );
}

export default function CategoriesPage() {
  const t = useTranslations('admin.categories');
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Feedback | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [sizeSets, setSizeSets] = useState<SizeSetOption[]>([]);
  // Image chosen in the form; uploaded after the category is saved (it needs an id).
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chooseImage = (file: File | null) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  // Free the last preview's object URL when the page unmounts.
  const previewRef = useRef<string | null>(null);
  previewRef.current = imagePreview;
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    chooseImage(null);
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch {
      setMessage({ type: 'error', text: t('loadFailed') });
    }
  };

  useEffect(() => {
    fetchCategories();
    api
      .get('/size-sets')
      .then((res) => setSizeSets(res.data))
      .catch(() => setSizeSets([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A category can't be its own parent or sit under one of its subcategories,
  // and only top-level categories can be parents (two levels).
  const editingHasChildren = !!editing && editing.children?.length > 0;
  const parentOptions = categories.filter(
    (cat) => !editing || (cat.id !== editing.id && !editing.children?.some((child) => child.id === cat.id)),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const data = {
        ...formData,
        // null moves a subcategory back to the top level
        parentId: formData.parentId || null,
        // null = inherit the parent's size set
        sizeSetId: formData.sizeSetId || null,
      };

      const saved = editing
        ? await api.put(`/admin/categories/${editing.id}`, data)
        : await api.post('/admin/categories', data);

      let imageFailed = false;
      if (imageFile) {
        try {
          const form = new FormData();
          form.append('file', imageFile, imageFile.name);
          await api.post(`/admin/categories/${saved.data.id}/image`, form);
        } catch {
          imageFailed = true;
        }
      }

      setMessage(
        imageFailed
          ? { type: 'error', text: t('imageFailed') }
          : { type: 'success', text: t(editing ? 'updatedSuccess' : 'createdSuccess') },
      );
      setShowForm(false);
      setEditing(null);
      resetForm();
      fetchCategories();
      await revalidateCatalog();
    } catch (err) {
      setMessage({ type: 'error', text: t(saveErrorKey(err)) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditing(cat);
    setFormData({
      nameHe: cat.nameHe,
      nameEn: cat.nameEn,
      slug: cat.slug,
      parentId: cat.parentId || '',
      sizeSetId: cat.sizeSetId || '',
      sortOrder: cat.sortOrder,
    });
    chooseImage(null);
    setShowForm(true);
  };

  const removeImage = async () => {
    if (!editing?.image || !confirm(t('removeImageConfirm'))) return;
    try {
      await api.delete(`/admin/categories/${editing.id}/image`);
      setEditing({ ...editing, image: null });
      setMessage({ type: 'success', text: t('imageRemoved') });
      fetchCategories();
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
      if (editing?.id === id) {
        setShowForm(false);
        setEditing(null);
      }
      fetchCategories();
      await revalidateCatalog();
    } catch (err) {
      setMessage({ type: 'error', text: t(deleteErrorKey(err)) });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <Button
          onClick={() => {
            setEditing(null);
            resetForm();
            setShowForm(true);
          }}
          className="gap-2 bg-ocean-700 text-white hover:bg-ocean-800"
        >
          <Plus size={16} /> {t('addCategory')}
        </Button>
      </div>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`mb-6 rounded-xl px-4 py-3 font-body text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-destructive border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card className="mb-8">
          <CardContent className="space-y-4">
            <CardTitle className="font-serif text-lg">
              {editing ? t('editCategory') : t('newCategory')}
            </CardTitle>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category-nameHe">{t('nameHe')}</Label>
                <Input
                  id="category-nameHe"
                  value={formData.nameHe}
                  onChange={(e) => setFormData({ ...formData, nameHe: e.target.value })}
                  required
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-nameEn">{t('nameEn')}</Label>
                <Input
                  id="category-nameEn"
                  value={formData.nameEn}
                  onChange={(e) => {
                    const nameEn = e.target.value;
                    setFormData({
                      ...formData,
                      nameEn,
                      slug: editing ? formData.slug : autoSlug(nameEn),
                    });
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-slug">{t('slug')}</Label>
                <Input
                  id="category-slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-parentId">{t('parentCategory')}</Label>
                <select
                  id="category-parentId"
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  disabled={editingHasChildren}
                  aria-describedby="category-parentId-hint"
                  className={selectClassName()}
                >
                  <option value="">{t('noneTopLevel')}</option>
                  {parentOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {locale === 'he' ? cat.nameHe : cat.nameEn}
                    </option>
                  ))}
                </select>
                <p id="category-parentId-hint" className="text-xs text-muted-foreground">
                  {editingHasChildren ? t('hasChildrenHint') : t('parentHint')}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-sortOrder">{t('sortOrder')}</Label>
                <Input
                  id="category-sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-sizeSetId">{t('sizeSet')}</Label>
                <select
                  id="category-sizeSetId"
                  value={formData.sizeSetId}
                  onChange={(e) => setFormData({ ...formData, sizeSetId: e.target.value })}
                  aria-describedby="category-sizeSetId-hint"
                  className={selectClassName()}
                >
                  <option value="">{t('sizeSetInherit')}</option>
                  {sizeSets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {locale === 'he' ? set.nameHe : set.nameEn}
                    </option>
                  ))}
                </select>
                <p id="category-sizeSetId-hint" className="text-xs text-muted-foreground">
                  {t('sizeSetHint')}
                </p>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium" id="category-image-label">
                  {t('image')}
                </span>
                <div className="flex items-center gap-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {(imagePreview || editing?.image) && (
                      <Image
                        src={imagePreview || editing!.image!}
                        alt=""
                        fill
                        sizes="80px"
                        unoptimized={!!imagePreview}
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                        className="sr-only"
                        id="category-image"
                        aria-labelledby="category-image-label"
                        onChange={(e) => chooseImage(e.target.files?.[0] ?? null)}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                        <ImagePlus size={14} /> {editing?.image || imagePreview ? t('replaceImage') : t('chooseImage')}
                      </Button>
                      {imagePreview ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => chooseImage(null)} className="gap-1.5">
                          <X size={14} /> {t('cancel')}
                        </Button>
                      ) : (
                        editing?.image && (
                          <Button type="button" variant="ghost" size="sm" onClick={removeImage} className="gap-1.5 text-destructive">
                            <Trash2 size={14} /> {t('removeImage')}
                          </Button>
                        )
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{imagePreview ? t('imagePending') : t('imageHint')}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-end gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-ocean-700 px-6 text-white hover:bg-ocean-800"
                >
                  {editing ? t('update') : t('create')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                    chooseImage(null);
                  }}
                  className="px-6"
                >
                  {t('cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Category tree */}
      <Card className="overflow-hidden p-0">
        {categories.length === 0 ? (
          <p className="p-6 text-muted-foreground text-center">{t('noCategories')}</p>
        ) : (
          categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              onEdit={handleEdit}
              onDelete={handleDelete}
              t={t}
              locale={locale}
            />
          ))
        )}
      </Card>
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
  t,
  locale,
  depth = 0,
}: {
  category: Category;
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  t: ReturnType<typeof useTranslations<'admin.categories'>>;
  locale: string;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;

  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted rounded-lg"
        style={{ paddingInlineStart: `${16 + depth * 24}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? t('collapse') : t('expand')}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
          ) : (
            <span className="w-5" />
          )}
          {category.image ? (
            <Image src={category.image} alt="" width={28} height={28} className="size-7 rounded object-cover" />
          ) : (
            <span className="size-7 rounded bg-muted" aria-hidden="true" />
          )}
          <span className="text-sm font-medium text-foreground">
            {locale === 'he' ? category.nameHe : category.nameEn}
          </span>
          <span className="text-xs text-muted-foreground">
            ({locale === 'he' ? category.nameEn : category.nameHe})
          </span>
          <span className="text-xs text-muted-foreground/60">/{category.slug}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(category)}
            className="text-muted-foreground hover:text-ocean-600"
            aria-label={t('editAction')}
          >
            <Pencil size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(category.id)}
            className="text-muted-foreground hover:text-destructive"
            aria-label={t('deleteAction')}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {expanded &&
        hasChildren &&
        category.children.map((child) => (
          <CategoryRow
            key={child.id}
            category={{ ...child, children: [] }}
            onEdit={onEdit}
            onDelete={onDelete}
            t={t}
            locale={locale}
            depth={depth + 1}
          />
        ))}
    </>
  );
}
