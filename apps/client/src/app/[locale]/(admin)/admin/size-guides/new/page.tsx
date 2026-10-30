'use client';

import { useTranslations } from 'next-intl';
import { SizeGuideEditor } from '@/components/admin/size-guides/SizeGuideEditor';

export default function NewSizeGuidePage() {
  const t = useTranslations('admin.sizeGuides');
  return (
    <div>
      <h1 className="mb-8 font-serif text-2xl font-bold tracking-normal">{t('newTitle')}</h1>
      <SizeGuideEditor guide={null} />
    </div>
  );
}
