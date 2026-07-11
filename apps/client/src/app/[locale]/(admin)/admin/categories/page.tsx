'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

type Category = {
  id: string;
  nameHe: string;
  nameEn: string;
  slug: string;
  sortOrder: number;
  parentId: string | null;
  children: Category[];
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    nameHe: '',
    nameEn: '',
    slug: '',
    parentId: '',
    sortOrder: 0,
  });

  const fetchCategories = async () => {
    const res = await api.get('/categories');
    setCategories(res.data);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      parentId: formData.parentId || undefined,
    };

    if (editing) {
      await api.put(`/admin/categories/${editing.id}`, data);
    } else {
      await api.post('/admin/categories', data);
    }

    setShowForm(false);
    setEditing(null);
    setFormData({ nameHe: '', nameEn: '', slug: '', parentId: '', sortOrder: 0 });
    fetchCategories();
  };

  const handleEdit = (cat: Category) => {
    setEditing(cat);
    setFormData({
      nameHe: cat.nameHe,
      nameEn: cat.nameEn,
      slug: cat.slug,
      parentId: cat.parentId || '',
      sortOrder: cat.sortOrder,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    await api.delete(`/admin/categories/${id}`);
    fetchCategories();
  };

  const autoSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light tracking-wider">Categories</h1>
        <button
          onClick={() => {
            setEditing(null);
            setFormData({ nameHe: '', nameEn: '', slug: '', parentId: '', sortOrder: 0 });
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-ocean-700 text-white px-4 py-2 text-sm hover:bg-ocean-800 transition-colors"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white p-6 border border-gray-200 mb-8">
          <h2 className="text-lg font-medium mb-4">
            {editing ? 'Edit Category' : 'New Category'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name (Hebrew)</label>
              <input
                value={formData.nameHe}
                onChange={(e) => setFormData({ ...formData, nameHe: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                required
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name (English)</label>
              <input
                value={formData.nameEn}
                onChange={(e) => {
                  const nameEn = e.target.value;
                  setFormData({
                    ...formData,
                    nameEn,
                    slug: editing ? formData.slug : autoSlug(nameEn),
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Slug</label>
              <input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Parent Category</label>
              <select
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
              >
                <option value="">None (Top Level)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Sort Order</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="bg-ocean-700 text-white px-6 py-2 text-sm hover:bg-ocean-800 transition-colors"
              >
                {editing ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-6 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors border border-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category tree */}
      <div className="bg-white border border-gray-200">
        {categories.length === 0 ? (
          <p className="p-6 text-gray-400 text-center">No categories yet.</p>
        ) : (
          categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
  depth = 0,
}: {
  category: Category;
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;

  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50"
        style={{ paddingInlineStart: `${16 + depth * 24}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button onClick={() => setExpanded(!expanded)} className="p-0.5">
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span className="text-sm font-medium">{category.nameEn}</span>
          <span className="text-xs text-gray-400">({category.nameHe})</span>
          <span className="text-xs text-gray-300">/{category.slug}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(category)}
            className="p-1.5 text-gray-400 hover:text-ocean-600 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(category.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {expanded &&
        hasChildren &&
        category.children.map((child) => (
          <CategoryRow
            key={child.id}
            category={{ ...child, children: [] }}
            onEdit={onEdit}
            onDelete={onDelete}
            depth={depth + 1}
          />
        ))}
    </>
  );
}
