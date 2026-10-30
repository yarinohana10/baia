'use client';

import type { FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { adminSelectClassName } from '@/components/admin/common/select-class';
import type { CategoryDraft } from '@/hooks/admin/category-editor';
import { autoSlug, parentOptions, type Category, type SizeGuideOption, type SizeSetOption } from './types';
import { CategoryImageField } from './CategoryImageField';

type Props = {
  draft: CategoryDraft;
  editing: Category | null;
  categories: Category[];
  sizeSets: SizeSetOption[];
  sizeGuides: SizeGuideOption[];
  submitting: boolean;
  image: { hasPendingFile: boolean; previewUrl: string | null; onPick: (file: File | null) => void; onRemoveSaved: () => void };
  onChange: (changes: Partial<CategoryDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

/** Create / edit category card. */
export function CategoryForm({ draft, editing, categories, sizeSets, sizeGuides, submitting, image, onChange, onSubmit, onCancel }: Props) {
  const t = useTranslations('admin.categories');
  const locale = useLocale();
  const editingHasChildren = !!editing && editing.children?.length > 0;
  const localName = (c: { nameHe: string; nameEn: string }) => (locale === 'he' ? c.nameHe : c.nameEn);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <Card className="mb-8">
      <CardContent className="space-y-4">
        <CardTitle className="font-serif text-lg">{editing ? t('editCategory') : t('newCategory')}</CardTitle>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="category-nameHe">{t('nameHe')}</Label>
            <Input id="category-nameHe" value={draft.nameHe} onChange={(e) => onChange({ nameHe: e.target.value })} required dir="rtl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-nameEn">{t('nameEn')}</Label>
            <Input
              id="category-nameEn"
              value={draft.nameEn}
              onChange={(e) => onChange({ nameEn: e.target.value, slug: editing ? draft.slug : autoSlug(e.target.value) })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-slug">{t('slug')}</Label>
            <Input id="category-slug" value={draft.slug} onChange={(e) => onChange({ slug: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-parentId">{t('parentCategory')}</Label>
            <select
              id="category-parentId"
              value={draft.parentId}
              onChange={(e) => onChange({ parentId: e.target.value })}
              disabled={editingHasChildren}
              aria-describedby="category-parentId-hint"
              className={adminSelectClassName()}
            >
              <option value="">{t('noneTopLevel')}</option>
              {parentOptions(categories, editing).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {localName(cat)}
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
              value={draft.sortOrder}
              onChange={(e) => onChange({ sortOrder: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-sizeSetId">{t('sizeSet')}</Label>
            <select
              id="category-sizeSetId"
              value={draft.sizeSetId}
              onChange={(e) => onChange({ sizeSetId: e.target.value })}
              aria-describedby="category-sizeSetId-hint"
              className={adminSelectClassName()}
            >
              <option value="">{t('sizeSetInherit')}</option>
              {sizeSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {localName(set)}
                </option>
              ))}
            </select>
            <p id="category-sizeSetId-hint" className="text-xs text-muted-foreground">
              {t('sizeSetHint')}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-sizeGuideId">{t('sizeGuide')}</Label>
            <select
              id="category-sizeGuideId"
              value={draft.sizeGuideId}
              onChange={(e) => onChange({ sizeGuideId: e.target.value })}
              aria-describedby="category-sizeGuideId-hint"
              className={adminSelectClassName()}
            >
              <option value="">{draft.parentId ? t('sizeGuideInherit') : t('sizeGuideNone')}</option>
              {sizeGuides.map((guide) => (
                <option key={guide.id} value={guide.id}>
                  {localName(guide)}
                </option>
              ))}
            </select>
            <p id="category-sizeGuideId-hint" className="text-xs text-muted-foreground">
              {t('sizeGuideHint')}
            </p>
          </div>
          <CategoryImageField savedImage={editing?.image} {...image} />
          <div className="flex items-end gap-3">
            <Button type="submit" disabled={submitting} className="bg-ocean-700 px-6 text-white hover:bg-ocean-800">
              {editing ? t('update') : t('create')}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="px-6">
              {t('cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
