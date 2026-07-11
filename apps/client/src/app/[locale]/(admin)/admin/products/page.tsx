'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { Plus, Pencil, Trash2, Eye, EyeOff, Star } from 'lucide-react';

type Product = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  basePrice: string;
  isActive: boolean;
  isFeatured: boolean;
  category: { nameEn: string };
  images: { url: string }[];
  _count: { variants: number };
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');

  const fetchProducts = async () => {
    const res = await api.get('/admin/products', { params: { search: search || undefined } });
    setProducts(res.data);
  };

  useEffect(() => { fetchProducts(); }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product and all its variants?')) return;
    await api.delete(`/admin/products/${id}`);
    fetchProducts();
  };

  const toggleActive = async (product: Product) => {
    await api.put(`/admin/products/${product.id}`, { isActive: !product.isActive });
    fetchProducts();
  };

  const toggleFeatured = async (product: Product) => {
    await api.put(`/admin/products/${product.id}`, { isFeatured: !product.isFeatured });
    fetchProducts();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light tracking-wider">Products</h1>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-ocean-700 text-white px-4 py-2 text-sm hover:bg-ocean-800 transition-colors"
        >
          <Plus size={16} /> Add Product
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
        />
      </div>

      {/* Product table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-start px-4 py-3 font-medium text-gray-500">Image</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Price</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Variants</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-end px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No products yet.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt=""
                        className="w-12 h-12 object-cover bg-gray-100"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{product.nameEn}</div>
                    <div className="text-xs text-gray-400">{product.nameHe}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{product.category.nameEn}</td>
                  <td className="px-4 py-3">₪{parseFloat(product.basePrice).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-600">{product._count.variants}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 ${
                        product.isActive
                          ? 'bg-green-50 text-green-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleFeatured(product)}
                        className={`p-1.5 transition-colors ${
                          product.isFeatured ? 'text-sand-500' : 'text-gray-300 hover:text-sand-500'
                        }`}
                        title="Toggle featured"
                      >
                        <Star size={14} fill={product.isFeatured ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => toggleActive(product)}
                        className="p-1.5 text-gray-400 hover:text-ocean-600 transition-colors"
                        title={product.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {product.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="p-1.5 text-gray-400 hover:text-ocean-600 transition-colors"
                      >
                        <Pencil size={14} />
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
