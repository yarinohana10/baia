'use client';

import { useTranslations } from 'next-intl';
import ProductForm from '@/components/admin/ProductForm';

export default function NewProductPage() {
  const t = useTranslations('admin.productForm');

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-normal mb-8">{t('newProduct')}</h1>
      <ProductForm />
    </div>
  );
}
