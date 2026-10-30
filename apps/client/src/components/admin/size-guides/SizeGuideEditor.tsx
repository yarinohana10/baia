'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { ExternalLink, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Link, useRouter } from '@/i18n/navigation';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { useFilePreview } from '@/hooks/admin/useFilePreview';
import { autoSlug } from '@/components/admin/categories/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormFeedback, type Feedback } from '@/components/admin/common/FormFeedback';
import type { SizeGuide } from '@/lib/catalog/size-guides';
import {
  EMPTY_GUIDE,
  emptyTable,
  guideIssues,
  guidePayload,
  guideToDraft,
  moveItem,
  removeItem,
  replaceItem,
  type GuideDraft,
} from '@/hooks/admin/size-guide-editor';
import { ImageField } from './ImageField';
import { StepsEditor } from './StepsEditor';
import { TableEditor } from './TableEditor';
import { TipsEditor } from './TipsEditor';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** Field-error code from the API (`duplicate slug` comes back as 409 on `slug`). */
function saveErrorKey(err: unknown): 'duplicateSlug' | 'invalidContent' | 'saveFailed' {
  if (!isAxiosError(err)) return 'saveFailed';
  if (err.response?.status === 409) return 'duplicateSlug';
  if (err.response?.status === 400) return 'invalidContent';
  return 'saveFailed';
}

async function uploadImage(id: string, file: File): Promise<SizeGuide | null> {
  try {
    const form = new FormData();
    form.append('file', file, file.name);
    return (await api.post<SizeGuide>(`/admin/size-guides/${id}/image`, form)).data;
  } catch {
    return null;
  }
}

/** Create / edit a size guide: details, illustration, tables, steps and tips. */
export function SizeGuideEditor({ guide }: { guide: SizeGuide | null }) {
  const t = useTranslations('admin.sizeGuides');
  const router = useRouter();
  const [saved, setSaved] = useState<SizeGuide | null>(guide);
  const [draft, setDraft] = useState<GuideDraft>(() => (guide ? guideToDraft(guide) : EMPTY_GUIDE));
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const image = useFilePreview();

  const issues = guideIssues(draft);
  const change = (changes: Partial<GuideDraft>) => setDraft((d) => ({ ...d, ...changes }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (issues.length > 0) {
      setShowIssues(true);
      setFeedback({ type: 'error', text: t('fixIssues') });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const body = guidePayload(draft);
      let result = saved
        ? (await api.put<SizeGuide>(`/admin/size-guides/${saved.id}`, body)).data
        : (await api.post<SizeGuide>('/admin/size-guides', body)).data;
      let imageOk = true;
      if (image.file) {
        const withImage = await uploadImage(result.id, image.file);
        imageOk = !!withImage;
        if (withImage) result = withImage;
        image.setFile(null);
      }
      setSaved(result);
      setShowIssues(false);
      await revalidateCatalog();
      setFeedback(imageOk ? { type: 'success', text: t('saved') } : { type: 'error', text: t('imageFailed') });
      if (!saved) router.replace(`/admin/size-guides/${result.id}`);
    } catch (err) {
      setFeedback({ type: 'error', text: t(saveErrorKey(err)) });
    } finally {
      setSubmitting(false);
    }
  };

  const removeSavedImage = async () => {
    if (!saved?.imageUrl || !confirm(t('removeImageConfirm'))) return;
    try {
      const res = await api.delete<SizeGuide>(`/admin/size-guides/${saved.id}/image`);
      setSaved(res.data);
      await revalidateCatalog();
      setFeedback({ type: 'success', text: t('imageRemoved') });
    } catch {
      setFeedback({ type: 'error', text: t('saveFailed') });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24" noValidate>
      {feedback && <FormFeedback feedback={feedback} />}
      {showIssues && issues.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-8 py-3 text-sm text-destructive">
          {issues.map((issue) => (
            <li key={issue}>{t(`issues.${issue}`)}</li>
          ))}
        </ul>
      )}

      <Section title={t('detailsTitle')}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="guide-nameHe">{t('nameHe')}</Label>
            <Input id="guide-nameHe" dir="rtl" value={draft.nameHe} onChange={(e) => change({ nameHe: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guide-nameEn">{t('nameEn')}</Label>
            <Input
              id="guide-nameEn"
              dir="ltr"
              value={draft.nameEn}
              onChange={(e) => change({ nameEn: e.target.value, ...(saved ? {} : { slug: autoSlug(e.target.value) }) })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guide-slug">{t('slug')}</Label>
            <Input id="guide-slug" dir="ltr" value={draft.slug} onChange={(e) => change({ slug: e.target.value })} aria-describedby="guide-slug-hint" required />
            <p id="guide-slug-hint" className="text-xs text-muted-foreground" dir="ltr">
              /size-guide/{draft.slug || '…'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guide-sortOrder">{t('sortOrder')}</Label>
            <Input
              id="guide-sortOrder"
              type="number"
              min={0}
              value={draft.sortOrder}
              onChange={(e) => change({ sortOrder: Math.max(0, parseInt(e.target.value) || 0) })}
              aria-describedby="guide-sortOrder-hint"
            />
            <p id="guide-sortOrder-hint" className="text-xs text-muted-foreground">
              {t('sortOrderHint')}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guide-introHe">{t('introHe')}</Label>
            <Textarea id="guide-introHe" dir="rtl" rows={3} value={draft.introHe} onChange={(e) => change({ introHe: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guide-introEn">{t('introEn')}</Label>
            <Textarea id="guide-introEn" dir="ltr" rows={3} value={draft.introEn} onChange={(e) => change({ introEn: e.target.value })} />
          </div>
          <label className="flex items-start gap-3 md:col-span-2">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => change({ isActive: e.target.checked })}
              className="mt-0.5 size-4 accent-ocean-700"
            />
            <span>
              <span className="block text-sm font-medium">{t('isActive')}</span>
              <span className="block text-xs text-muted-foreground">{t('isActiveHint')}</span>
            </span>
          </label>
        </div>
      </Section>

      <Section title={t('imageTitle')} hint={t('imageSectionHint')}>
        <ImageField
          savedImage={saved?.imageUrl ?? null}
          hasPendingFile={!!image.file}
          previewUrl={image.previewUrl}
          onPick={image.setFile}
          onRemoveSaved={removeSavedImage}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="guide-altHe">{t('imageAltHe')}</Label>
            <Input id="guide-altHe" dir="rtl" value={draft.imageAltHe} onChange={(e) => change({ imageAltHe: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guide-altEn">{t('imageAltEn')}</Label>
            <Input id="guide-altEn" dir="ltr" value={draft.imageAltEn} onChange={(e) => change({ imageAltEn: e.target.value })} />
          </div>
        </div>
      </Section>

      <Section title={t('tablesTitle')} hint={t('tablesHint')}>
        {draft.tables.map((table, i) => (
          <TableEditor
            key={table.key}
            table={table}
            index={i}
            total={draft.tables.length}
            onChange={(next) => change({ tables: replaceItem(draft.tables, table.key, next) })}
            onMove={(d) => change({ tables: moveItem(draft.tables, table.key, d) })}
            onRemove={() => confirm(t('removeTableConfirm')) && change({ tables: removeItem(draft.tables, table.key) })}
          />
        ))}
        <Button type="button" variant="outline" onClick={() => change({ tables: [...draft.tables, emptyTable()] })} className="gap-1.5">
          <Plus size={15} /> {t('addTable')}
        </Button>
      </Section>

      <Section title={t('stepsTitle')} hint={t('stepsHint')}>
        <StepsEditor steps={draft.steps} onChange={(steps) => change({ steps })} />
      </Section>

      <Section title={t('tipsTitle')} hint={t('tipsHint')}>
        <TipsEditor tips={draft.tips} onChange={(tips) => change({ tips })} />
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="submit" disabled={submitting} className="bg-ocean-700 px-6 text-white hover:bg-ocean-800">
          {submitting ? t('saving') : saved ? t('save') : t('create')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/size-guides')} className="px-6">
          {t('back')}
        </Button>
        {saved?.isActive && (
          <Link
            href={`/size-guide/${saved.slug}`}
            target="_blank"
            className="ms-auto inline-flex items-center gap-1.5 text-sm text-ocean-700 underline-offset-4 hover:underline"
          >
            <ExternalLink size={14} /> {t('viewOnSite')}
          </Link>
        )}
      </div>
    </form>
  );
}
