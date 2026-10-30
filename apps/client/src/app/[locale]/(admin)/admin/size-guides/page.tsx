'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, Pencil, Plus, Ruler, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { localized, type SizeGuide } from '@/lib/catalog/size-guides';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormFeedback, type Feedback } from '@/components/admin/common/FormFeedback';

export default function SizeGuidesPage() {
  const t = useTranslations('admin.sizeGuides');
  const locale = useLocale();
  const [guides, setGuides] = useState<SizeGuide[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const load = useCallback(() => {
    api.get<SizeGuide[]>('/admin/size-guides').then(
      (res) => setGuides(res.data),
      () => {
        setGuides([]);
        setFeedback({ type: 'error', text: t('loadFailed') });
      },
    );
  }, [t]);

  useEffect(load, [load]);

  const handleDelete = async (guide: SizeGuide) => {
    if (!confirm(t('deleteConfirm', { name: localized(locale, guide.nameHe, guide.nameEn) }))) return;
    try {
      await api.delete(`/admin/size-guides/${guide.id}`);
      setFeedback({ type: 'success', text: t('deleted') });
      load();
      await revalidateCatalog();
    } catch {
      setFeedback({ type: 'error', text: t('deleteFailed') });
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <Link
          href="/admin/size-guides/new"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-ocean-700 px-4 text-sm font-medium text-white hover:bg-ocean-800"
        >
          <Plus size={16} /> {t('add')}
        </Link>
      </div>
      <p className="mb-8 max-w-2xl text-sm text-muted-foreground">{t('intro')}</p>

      {feedback && <FormFeedback feedback={feedback} />}

      {guides === null ? (
        <p className="py-12 text-center text-muted-foreground">{t('loading')}</p>
      ) : guides.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Ruler size={28} className="text-muted-foreground" />
          <p className="text-muted-foreground">{t('empty')}</p>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {guides.map((guide) => (
            <li key={guide.id}>
              <Card className="flex h-full flex-row gap-4 p-4">
                <div className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  {guide.imageUrl && <Image src={guide.imageUrl} alt="" fill sizes="80px" className="object-contain" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{localized(locale, guide.nameHe, guide.nameEn)}</h2>
                    <Badge variant={guide.isActive ? 'secondary' : 'outline'}>{guide.isActive ? t('active') : t('hidden')}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                    /size-guide/{guide.slug}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('summary', { tables: guide.tables.length, steps: guide.steps.length, tips: guide.tips.length })}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">{t('linkedCategories')}: </span>
                    {guide.categories.length > 0
                      ? guide.categories.map((c) => localized(locale, c.nameHe, c.nameEn)).join(', ')
                      : t('noCategories')}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
                    <Link
                      href={`/admin/size-guides/${guide.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-muted"
                    >
                      <Pencil size={14} /> {t('edit')}
                    </Link>
                    {guide.isActive && (
                      <Link
                        href={`/size-guide/${guide.slug}`}
                        target="_blank"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm text-ocean-700 hover:bg-muted"
                      >
                        <ExternalLink size={14} /> {t('viewOnSite')}
                      </Link>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(guide)}
                      className="ms-auto gap-1.5 text-destructive"
                      aria-label={t('deleteNamed', { name: localized(locale, guide.nameHe, guide.nameEn) })}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
