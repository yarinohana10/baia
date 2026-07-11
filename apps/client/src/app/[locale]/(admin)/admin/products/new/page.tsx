'use client';

import ProductForm from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div>
      <h1 className="text-2xl font-light tracking-wider mb-8">New Product</h1>
      <ProductForm />
    </div>
  );
}
