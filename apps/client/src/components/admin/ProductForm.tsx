'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import {
  Save,
  Plus,
  Trash2,
  Upload,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type Category = {
  id: string;
  nameEn: string;
  children: { id: string; nameEn: string }[];
};

type Variant = {
  id?: string;
  color: string;
  size: string;
  sku: string;
  stockQuantity: number;
  priceOverride: number | null;
  salePrice: number | null;
  saleStart: string | null;
  saleEnd: string | null;
  isActive: boolean;
  isNew?: boolean;
};

type ProductImage = {
  id: string;
  url: string;
  color?: string;
  sortOrder: number;
};

type Props = {
  product?: {
    id: string;
    nameHe: string;
    nameEn: string;
    descriptionHe?: string;
    descriptionEn?: string;
    slug: string;
    basePrice: string;
    categoryId: string;
    isFeatured: boolean;
    isActive: boolean;
    variants: Variant[];
    images: ProductImage[];
  };
};

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const LOW_STOCK_THRESHOLD = 5;

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function ProductForm({ product }: Props) {
  const router = useRouter();
  const isEdit = !!product;

  const [nameHe, setNameHe] = useState(product?.nameHe || '');
  const [nameEn, setNameEn] = useState(product?.nameEn || '');
  const [descHe, setDescHe] = useState(product?.descriptionHe || '');
  const [descEn, setDescEn] = useState(product?.descriptionEn || '');
  const [slug, setSlug] = useState(product?.slug || '');
  const [basePrice, setBasePrice] = useState(product ? parseFloat(product.basePrice).toString() : '');
  const [categoryId, setCategoryId] = useState(product?.categoryId || '');
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured || false);
  const [autoSlug, setAutoSlug] = useState(!isEdit);

  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>(product?.variants || []);
  const [images, setImages] = useState<ProductImage[]>(product?.images || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showVariants, setShowVariants] = useState(true);
  const [showImages, setShowImages] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data));
  }, []);

  useEffect(() => {
    if (autoSlug && nameEn) {
      setSlug(slugify(nameEn));
    }
  }, [nameEn, autoSlug]);

  const handleSave = async () => {
    setError('');
    setSaving(true);

    try {
      const payload = {
        nameHe,
        nameEn,
        descriptionHe: descHe || undefined,
        descriptionEn: descEn || undefined,
        slug,
        basePrice: parseFloat(basePrice),
        categoryId,
        isFeatured,
      };

      let productId = product?.id;

      if (isEdit) {
        await api.put(`/admin/products/${productId}`, payload);
      } else {
        const res = await api.post('/admin/products', payload);
        productId = res.data.id;
      }

      // Save new variants
      const newVariants = variants.filter((v) => v.isNew);
      for (const v of newVariants) {
        await api.post(`/admin/products/${productId}/variants`, {
          color: v.color,
          size: v.size,
          sku: v.sku,
          stockQuantity: v.stockQuantity,
          priceOverride: v.priceOverride,
          salePrice: v.salePrice,
          saleStart: v.saleStart,
          saleEnd: v.saleEnd,
        });
      }

      const existingVariants = variants.filter((v) => v.id && !v.isNew);
      for (const v of existingVariants) {
        await api.put(`/admin/variants/${v.id}`, {
          color: v.color,
          size: v.size,
          sku: v.sku,
          stockQuantity: v.stockQuantity,
          priceOverride: v.priceOverride,
          salePrice: v.salePrice,
          saleStart: v.saleStart,
          saleEnd: v.saleEnd,
          isActive: v.isActive,
        });
      }

      router.push('/admin/products');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        color: '',
        size: 'M',
        sku: '',
        stockQuantity: 0,
        priceOverride: null,
        salePrice: null,
        saleStart: null,
        saleEnd: null,
        isActive: true,
        isNew: true,
      },
    ]);
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const updated = [...variants];
    (updated[index] as any)[field] = value;
    setVariants(updated);
  };

  const removeVariant = async (index: number) => {
    const v = variants[index];
    if (v.id) {
      if (!confirm('Delete this variant?')) return;
      await api.delete(`/admin/variants/${v.id}`);
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!product?.id || !e.target.files) return;

    for (const file of Array.from(e.target.files)) {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post(`/admin/products/${product.id}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImages((prev) => [...prev, res.data]);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Delete this image?')) return;
    await api.delete(`/admin/images/${imageId}`);
    setImages(images.filter((img) => img.id !== imageId));
  };

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Basic Info */}
      <section className="bg-white border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-medium text-gray-800">Product Details</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name (English)</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
              placeholder="Women's Bikini Set"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name (Hebrew)</label>
            <input
              type="text"
              value={nameHe}
              onChange={(e) => setNameHe(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
              dir="rtl"
              placeholder="סט ביקיני לנשים"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Description (English)
            </label>
            <textarea
              value={descEn}
              onChange={(e) => setDescEn(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Description (Hebrew)
            </label>
            <textarea
              value={descHe}
              onChange={(e) => setDescHe(e.target.value)}
              rows={3}
              dir="rtl"
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setAutoSlug(false);
              }}
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Base Price (₪)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
              placeholder="199.90"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none bg-white"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <optgroup key={cat.id} label={cat.nameEn}>
                  <option value={cat.id}>{cat.nameEn}</option>
                  {cat.children?.map((child) => (
                    <option key={child.id} value={child.id}>
                      &nbsp;&nbsp;{child.nameEn}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="accent-ocean-700"
          />
          Featured on homepage
        </label>
      </section>

      {/* Variants */}
      <section className="bg-white border border-gray-200">
        <button
          onClick={() => setShowVariants(!showVariants)}
          className="w-full flex items-center justify-between p-6 text-lg font-medium text-gray-800"
        >
          <span>Variants ({variants.length})</span>
          {showVariants ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showVariants && (
          <div className="px-6 pb-6 space-y-3">
            {variants.map((v, i) => (
              <div
                key={v.id || i}
                className={`p-3 border space-y-2 ${
                  v.stockQuantity > 0 && v.stockQuantity <= LOW_STOCK_THRESHOLD
                    ? 'border-amber-300 bg-amber-50'
                    : v.stockQuantity === 0
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="grid grid-cols-[1fr_80px_1fr_100px_100px_40px] gap-3 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Color</label>
                    <input
                      type="text"
                      value={v.color}
                      onChange={(e) => updateVariant(i, 'color', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                      placeholder="Black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Size</label>
                    <select
                      value={v.size}
                      onChange={(e) => updateVariant(i, 'size', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none bg-white"
                    >
                      {SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">SKU</label>
                    <input
                      type="text"
                      value={v.sku}
                      onChange={(e) => updateVariant(i, 'sku', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                      placeholder="BKN-BLK-M"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Stock</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={v.stockQuantity}
                        onChange={(e) => updateVariant(i, 'stockQuantity', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                      />
                      {v.stockQuantity > 0 && v.stockQuantity <= LOW_STOCK_THRESHOLD && (
                        <AlertTriangle
                          size={12}
                          className="absolute end-2 top-1/2 -translate-y-1/2 text-amber-500"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">Price ₪</label>
                    <input
                      type="number"
                      step="0.01"
                      value={v.priceOverride ?? ''}
                      onChange={(e) =>
                        updateVariant(
                          i,
                          'priceOverride',
                          e.target.value ? parseFloat(e.target.value) : null,
                        )
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                      placeholder="Base"
                    />
                  </div>
                  <button
                    onClick={() => removeVariant(i)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Sale price row */}
                <div className="grid grid-cols-3 gap-3 pt-1 border-t border-dashed border-gray-200">
                  <div>
                    <label className="block text-xs text-red-500 mb-0.5">Sale Price ₪</label>
                    <input
                      type="number"
                      step="0.01"
                      value={v.salePrice ?? ''}
                      onChange={(e) =>
                        updateVariant(
                          i,
                          'salePrice',
                          e.target.value ? parseFloat(e.target.value) : null,
                        )
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:border-red-400 focus:outline-none"
                      placeholder="No sale"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-red-500 mb-0.5">Sale Start</label>
                    <input
                      type="date"
                      value={v.saleStart ? v.saleStart.split('T')[0] : ''}
                      onChange={(e) =>
                        updateVariant(i, 'saleStart', e.target.value || null)
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:border-red-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-red-500 mb-0.5">Sale End</label>
                    <input
                      type="date"
                      value={v.saleEnd ? v.saleEnd.split('T')[0] : ''}
                      onChange={(e) =>
                        updateVariant(i, 'saleEnd', e.target.value || null)
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:border-red-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addVariant}
              className="flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-700 mt-2"
            >
              <Plus size={14} /> Add variant
            </button>
          </div>
        )}
      </section>

      {/* Images (only for existing products) */}
      {isEdit && (
        <section className="bg-white border border-gray-200">
          <button
            onClick={() => setShowImages(!showImages)}
            className="w-full flex items-center justify-between p-6 text-lg font-medium text-gray-800"
          >
            <span>Images ({images.length})</span>
            {showImages ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {showImages && (
            <div className="px-6 pb-6">
              <div className="grid grid-cols-4 gap-4 mb-4">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.url}
                      alt=""
                      className="w-full aspect-square object-cover bg-gray-100"
                    />
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute top-1 end-1 p-1 bg-white/80 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-ocean-600 hover:text-ocean-700 cursor-pointer">
                <Upload size={14} />
                Upload images
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </section>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !nameEn || !nameHe || !slug || !basePrice || !categoryId}
          className="flex items-center gap-2 bg-ocean-700 text-white px-6 py-2.5 text-sm hover:bg-ocean-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save size={14} /> {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
        </button>
        <button
          onClick={() => router.push('/admin/products')}
          className="px-6 py-2.5 text-sm border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
