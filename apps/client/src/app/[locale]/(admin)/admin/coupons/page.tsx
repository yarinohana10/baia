'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, X, Eye, EyeOff } from 'lucide-react';

type Coupon = {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  value: string;
  minCartValue: string | null;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  expiresAt: string | null;
  _count: { orders: number };
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [minCartValue, setMinCartValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const fetchCoupons = async () => {
    const res = await api.get('/admin/coupons');
    setCoupons(res.data);
  };

  useEffect(() => { fetchCoupons(); }, []);

  const resetForm = () => {
    setCode('');
    setDiscountType('PERCENTAGE');
    setValue('');
    setMinCartValue('');
    setMaxUses('');
    setExpiresAt('');
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (c: Coupon) => {
    setCode(c.code);
    setDiscountType(c.discountType);
    setValue(parseFloat(c.value).toString());
    setMinCartValue(c.minCartValue ? parseFloat(c.minCartValue).toString() : '');
    setMaxUses(c.maxUses?.toString() || '');
    setExpiresAt(c.expiresAt ? c.expiresAt.split('T')[0] : '');
    setEditing(c);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const payload = {
      code,
      discountType,
      value: parseFloat(value),
      minCartValue: minCartValue ? parseFloat(minCartValue) : undefined,
      maxUses: maxUses ? parseInt(maxUses) : undefined,
      expiresAt: expiresAt || undefined,
    };

    if (editing) {
      await api.put(`/admin/coupons/${editing.id}`, payload);
    } else {
      await api.post('/admin/coupons', payload);
    }

    resetForm();
    fetchCoupons();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    await api.delete(`/admin/coupons/${id}`);
    fetchCoupons();
  };

  const toggleActive = async (c: Coupon) => {
    await api.put(`/admin/coupons/${c.id}`, { isActive: !c.isActive });
    fetchCoupons();
  };

  const isExpired = (c: Coupon) => c.expiresAt && new Date(c.expiresAt) < new Date();
  const isMaxedOut = (c: Coupon) => c.maxUses !== null && c.currentUses >= c.maxUses;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light tracking-wider">Coupons</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-ocean-700 text-white px-4 py-2 text-sm hover:bg-ocean-800 transition-colors"
        >
          <Plus size={16} /> Create Coupon
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 p-6 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{editing ? 'Edit Coupon' : 'New Coupon'}</h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none uppercase"
                placeholder="SUMMER25"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none bg-white"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₪)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Value {discountType === 'PERCENTAGE' ? '(%)' : '(₪)'}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                placeholder={discountType === 'PERCENTAGE' ? '25' : '50'}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Min Cart Value (₪)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minCartValue}
                onChange={(e) => setMinCartValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Uses</label>
              <input
                type="number"
                min="0"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
                placeholder="Unlimited"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Expires</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:border-ocean-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!code || !value}
            className="bg-ocean-700 text-white px-5 py-2 text-sm hover:bg-ocean-800 transition-colors disabled:opacity-40"
          >
            {editing ? 'Update' : 'Create'}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-start px-4 py-3 font-medium text-gray-500">Code</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Discount</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Min Cart</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Usage</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Expires</th>
              <th className="text-start px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-end px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No coupons yet.
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">
                    {c.discountType === 'PERCENTAGE'
                      ? `${parseFloat(c.value)}%`
                      : `₪${parseFloat(c.value).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.minCartValue ? `₪${parseFloat(c.minCartValue).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.currentUses}{c.maxUses ? ` / ${c.maxUses}` : ''}{' '}
                    <span className="text-xs text-gray-400">({c._count.orders} orders)</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.expiresAt
                      ? new Date(c.expiresAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    {isExpired(c) ? (
                      <span className="text-xs px-2 py-0.5 bg-red-50 text-red-500">Expired</span>
                    ) : isMaxedOut(c) ? (
                      <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-500">Maxed</span>
                    ) : c.isActive ? (
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleActive(c)}
                        className="p-1.5 text-gray-400 hover:text-ocean-600 transition-colors"
                      >
                        {c.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        onClick={() => startEdit(c)}
                        className="p-1.5 text-gray-400 hover:text-ocean-600 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
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
