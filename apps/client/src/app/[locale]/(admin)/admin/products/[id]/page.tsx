'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import ProductForm from '@/components/admin/ProductForm';

export default function EditProductPage() {
  const t = useTranslations('admin.productForm');
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/products/${id}`)
      .then((res) => setProduct(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-12 text-center text-gray-400">{t('loading')}</div>;
  if (!product) return <div className="py-12 text-center text-gray-400">{t('notFound')}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-normal mb-8">{t('editProduct')}</h1>
      <ProductForm product={product} />
    </div>
  );
}
