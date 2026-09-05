'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

type Category = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  sortOrder: number;
  parentId: string | null;
  children: Category[];
};

function autoSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
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
  const [formData, setFormData] = useState({
    nameHe: '',
    nameEn: '',
    slug: '',
    parentId: '',
    sortOrder: 0,
  });

  const fetchCategories = async () => {
    const res = await api.get('/categories');
    setCategories(res.data);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const data = {
        ...formData,
        parentId: formData.parentId || undefined,
      };

      if (editing) {
        await api.put(`/admin/categories/${editing.id}`, data);
      } else {
        await api.post('/admin/categories', data);
      }

      setShowForm(false);
      setEditing(null);
      setFormData({ nameHe: '', nameEn: '', slug: '', parentId: '', sortOrder: 0 });
      fetchCategories();
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
      sortOrder: cat.sortOrder,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    await api.delete(`/admin/categories/${id}`);
    fetchCategories();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setFormData({ nameHe: '', nameEn: '', slug: '', parentId: '', sortOrder: 0 });
            setShowForm(true);
          }}
          className="gap-2 bg-ocean-700 text-white hover:bg-ocean-800"
        >
          <Plus size={16} /> {t('addCategory')}
        </Button>
      </div>

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
                  className={selectClassName()}
                >
                  <option value="">{t('noneTopLevel')}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {locale === 'he' ? cat.nameHe : cat.nameEn}
                    </option>
                  ))}
                </select>
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
