'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { localized, type SizeGuide } from '@/lib/catalog/size-guides';
import { SizeGuideEditor } from '@/components/admin/size-guides/SizeGuideEditor';

export default function EditSizeGuidePage() {
  const t = useTranslations('admin.sizeGuides');
  const locale = useLocale();
  const id = useParams().id as string;
  const [guide, setGuide] = useState<SizeGuide | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<SizeGuide>(`/admin/size-guides/${id}`)
      .then((res) => setGuide(res.data), () => setGuide(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">{t('loading')}</div>;
  if (!guide) return <div className="py-12 text-center text-muted-foreground">{t('notFound')}</div>;

  return (
    <div>
      <h1 className="mb-8 font-serif text-2xl font-bold tracking-normal">
        {t('editTitle', { name: localized(locale, guide.nameHe, guide.nameEn) })}
      </h1>
      <SizeGuideEditor key={guide.id} guide={guide} />
    </div>
  );
}
