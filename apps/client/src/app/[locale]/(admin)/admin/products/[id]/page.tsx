'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import ProductForm from '@/components/admin/ProductForm';

export default function EditProductPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/products/${id}`)
      .then((res) => setProduct(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-12 text-center text-gray-400">Loading...</div>;
  if (!product) return <div className="py-12 text-center text-gray-400">Product not found.</div>;

  return (
    <div>
      <h1 className="text-2xl font-light tracking-wider mb-8">Edit Product</h1>
      <ProductForm product={product} />
    </div>
  );
}
