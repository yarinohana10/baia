'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
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

function selectClassName() {
  return cn(
    'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${d.getFullYear()}`;
}

function isExpired(c: Coupon) {
  return c.expiresAt !== null && new Date(c.expiresAt) < new Date();
}

function isMaxedOut(c: Coupon) {
  return c.maxUses !== null && c.currentUses >= c.maxUses;
}

export default function CouponsPage() {
  const t = useTranslations('admin.coupons');
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
    if (!confirm(t('deleteConfirm'))) return;
    await api.delete(`/admin/coupons/${id}`);
    fetchCoupons();
  };

  const toggleActive = async (c: Coupon) => {
    await api.put(`/admin/coupons/${c.id}`, { isActive: !c.isActive });
    fetchCoupons();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <Button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="gap-2 bg-ocean-700 text-white hover:bg-ocean-800"
        >
          <Plus size={16} /> {t('createCoupon')}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="mb-6">
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif">{editing ? t('editCoupon') : t('newCoupon')}</CardTitle>
              <Button type="button" variant="ghost" size="icon-sm" onClick={resetForm} className="text-muted-foreground" aria-label={t('closeForm')}>
                <X size={16} />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="coupon-code">{t('code')}</Label>
                <Input
                  id="coupon-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="uppercase"
                  placeholder="SUMMER25"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-discountType">{t('type')}</Label>
                <select
                  id="coupon-discountType"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')}
                  className={selectClassName()}
                >
                  <option value="PERCENTAGE">{t('percentage')}</option>
                  <option value="FIXED">{t('fixedAmount')}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-value">
                  {`${t('value')} ${discountType === 'PERCENTAGE' ? '(%)' : '(₪)'}`}
                </Label>
                <Input
                  id="coupon-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={discountType === 'PERCENTAGE' ? '25' : '50'}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="coupon-minCartValue">{t('minCartValue')}</Label>
                <Input
                  id="coupon-minCartValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minCartValue}
                  onChange={(e) => setMinCartValue(e.target.value)}
                  placeholder={t('optional')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-maxUses">{t('maxUses')}</Label>
                <Input
                  id="coupon-maxUses"
                  type="number"
                  min="0"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder={t('unlimited')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-expiresAt">{t('expires')}</Label>
                <Input
                  id="coupon-expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!code || !value}
              className="bg-ocean-700 text-white hover:bg-ocean-800"
            >
              {editing ? t('update') : t('create')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('code')}</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('discount')}</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('minCart')}</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('usage')}</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('expires')}</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('status')}</th>
              <th className="text-end px-4 py-3 font-medium text-muted-foreground">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {t('noCoupons')}
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">
                    {c.discountType === 'PERCENTAGE'
                      ? `${parseFloat(c.value)}%`
                      : `₪${parseFloat(c.value).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.minCartValue ? `₪${parseFloat(c.minCartValue).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.currentUses}{c.maxUses ? ` / ${c.maxUses}` : ''}{' '}
                    <span className="text-xs text-muted-foreground">({c._count.orders} {t('orders')})</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.expiresAt ? formatDate(c.expiresAt) : t('never')}
                  </td>
                  <td className="px-4 py-3">
                    {isExpired(c) ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-destructive">{t('expired')}</span>
                    ) : isMaxedOut(c) ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">{t('maxed')}</span>
                    ) : c.isActive ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">{t('active')}</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t('inactive')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleActive(c)}
                        className="text-muted-foreground hover:text-ocean-600"
                        aria-label={c.isActive ? t('deactivate') : t('activateCoupon')}
                      >
                        {c.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEdit(c)}
                        className="text-muted-foreground hover:text-ocean-600"
                        aria-label={t('editAction')}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(c.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t('deleteAction')}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
