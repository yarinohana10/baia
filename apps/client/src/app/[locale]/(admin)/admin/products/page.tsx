'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { Plus, Pencil, Trash2, Eye, EyeOff, Star, Search } from 'lucide-react';

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[32px] leading-tight text-[#1a1c1c]">Products</h1>
          <p className="mt-1 font-body text-sm text-[#3f484c]">
            Manage your product catalog
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 rounded-full bg-[#565555] px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-[#1a1c1c]"
        >
          <Plus size={16} /> Add Product
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[#3f484c]"
        />
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-full bg-[#eeeeee] py-2.5 ps-10 pe-4 font-body text-sm text-[#1a1c1c] placeholder:text-[#3f484c]/60 focus:outline-none focus:ring-2 focus:ring-[#005d72]/20"
        />
      </div>

      {/* Product table */}
      <div className="overflow-hidden rounded-xl border border-[#eeeeee] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#eeeeee] bg-[#f3f3f4]">
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                Image
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                Name
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                Category
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                Price
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                Variants
              </th>
              <th className="px-5 py-3.5 text-start font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                Status
              </th>
              <th className="px-5 py-3.5 text-end font-body text-xs font-semibold uppercase tracking-[0.06em] text-[#3f484c]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center font-body text-sm text-[#3f484c]">
                  No products yet.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-[#f3f3f4] transition-colors last:border-0 hover:bg-[#f9f9f9]"
                >
                  <td className="px-5 py-4">
                    {product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt=""
                        className="h-12 w-12 rounded-lg bg-[#f3f3f4] object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-[#f3f3f4]" />
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {product.isFeatured && (
                        <Star
                          size={14}
                          className="shrink-0 fill-[#005d72] text-[#005d72]"
                        />
                      )}
                      <div>
                        <div className="font-body font-medium text-[#1a1c1c]">{product.nameEn}</div>
                        <div className="font-body text-xs text-[#3f484c]">{product.nameHe}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-body text-[#3f484c]">{product.category.nameEn}</td>
                  <td className="px-5 py-4 font-body font-medium text-[#1a1c1c]">
                    ₪{parseFloat(product.basePrice).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 font-body text-[#3f484c]">{product._count.variants}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 font-body text-xs font-medium ${
                        product.isActive
                          ? 'bg-[#e7e2d9] text-[#005d72]'
                          : 'bg-[#f3f3f4] text-[#3f484c]'
                      }`}
                    >
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleFeatured(product)}
                        className={`rounded-lg p-2 transition-colors ${
                          product.isFeatured
                            ? 'text-[#005d72] hover:bg-[#e7e2d9]'
                            : 'text-[#bec8cd] hover:bg-[#f3f3f4] hover:text-[#005d72]'
                        }`}
                        title="Toggle featured"
                      >
                        <Star size={16} fill={product.isFeatured ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => toggleActive(product)}
                        className="rounded-lg p-2 text-[#3f484c] transition-colors hover:bg-[#f3f3f4] hover:text-[#005d72]"
                        title={product.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {product.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="rounded-lg p-2 text-[#3f484c] transition-colors hover:bg-[#f3f3f4] hover:text-[#005d72]"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="rounded-lg p-2 text-[#3f484c] transition-colors hover:bg-red-50 hover:text-[#ba1a1a]"
                      >
                        <Trash2 size={16} />
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
