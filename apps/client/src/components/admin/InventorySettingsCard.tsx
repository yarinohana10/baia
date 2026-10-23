'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { PackageSearch, Save } from 'lucide-react';
import { inventorySettingsSchema } from '@baia/shared';
import { api } from '@/lib/api';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { validateForm } from '@/lib/form-errors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FieldError } from '@/components/forms/FieldError';

/** "מלאי" section of the admin settings: the low-stock threshold for alerts and the "only N left" hint. */
export function InventorySettingsCard() {
  const t = useTranslations('admin.settings');
  const [threshold, setThreshold] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/site-config')
      .then((res) => !cancelled && setThreshold(String(res.data.lowStockThreshold ?? 5)))
      .catch(() => !cancelled && setMessage({ type: 'error', text: t('loadFailed') }));
    return () => {
      cancelled = true;
    };
  }, [t]);

  const check = validateForm(inventorySettingsSchema, { lowStockThreshold: threshold ?? '' });
  const issue = check.errors.lowStockThreshold;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!check.success || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/admin/site-config', check.data);
      setMessage({ type: 'success', text: t('inventorySaved') });
      await revalidateCatalog();
    } catch {
      setMessage({ type: 'error', text: t('inventorySaveFailed') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PackageSearch size={18} className="text-ocean-700" />
          <CardTitle className="font-serif text-xl">{t('inventory')}</CardTitle>
        </div>
        <p className="font-body text-sm text-muted-foreground">{t('inventoryDescription')}</p>
      </CardHeader>
      <CardContent>
        {threshold === null ? (
          <p className="font-body text-sm text-muted-foreground">{message?.text ?? t('loading')}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inventory-lowStockThreshold" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('lowStockThreshold')}
              </Label>
              <Input
                id="inventory-lowStockThreshold"
                dir="ltr"
                inputMode="numeric"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                aria-invalid={!!issue}
                aria-describedby={issue ? 'inventory-lowStockThreshold-error' : 'inventory-lowStockThreshold-hint'}
              />
              <FieldError id="inventory-lowStockThreshold-error" issue={issue} className="font-body text-destructive" />
              <p id="inventory-lowStockThreshold-hint" className="font-body text-xs text-muted-foreground">
                {t('lowStockThresholdHint')}
              </p>
            </div>

            {message && (
              <div
                role={message.type === 'error' ? 'alert' : 'status'}
                className={`rounded-xl px-4 py-3 font-body text-sm ${
                  message.type === 'success'
                    ? 'border border-green-200 bg-green-50 text-green-700'
                    : 'border border-red-200 bg-red-50 text-destructive'
                }`}
              >
                {message.text}
              </div>
            )}

            <Button type="submit" disabled={saving || !check.success} className="gap-2 bg-ocean-700 px-6 py-3 text-white hover:bg-ocean-800">
              <Save size={16} />
              {saving ? t('saving') : t('saveInventory')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
