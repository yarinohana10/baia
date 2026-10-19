'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { Check } from 'lucide-react';
import { pickupPointSchema } from '@baia/shared';
import { api } from '@/lib/api';
import { invalidProps, validateForm, type FieldIssues } from '@/lib/form-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/forms/FieldError';
import type { PointDraft } from './types';

type Props = {
  /** The point's id, or 'new'. */
  pointId: string;
  initialDraft: PointDraft;
  onSaved: () => void;
  onCancel: () => void;
};

/** Add / edit form for a pickup point. */
export function PickupPointForm({ pointId, initialDraft, onSaved, onCancel }: Props) {
  const t = useTranslations('admin.delivery');
  const [draft, setDraft] = useState(initialDraft);
  const [issues, setIssues] = useState<FieldIssues>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const change = (changes: Partial<PointDraft>) => setDraft({ ...draft, ...changes });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const check = validateForm(pickupPointSchema, draft);
    setIssues(check.errors);
    if (!check.success) {
      const missing = (['name', 'city', 'address'] as const).some((f) => check.errors[f]?.key === 'validation.required');
      setError(missing ? t('pointRequiredFields') : t('pointInvalid'));
      return;
    }
    // Blank hours clear the field; a blank sort order means 0.
    const body = { ...check.data, hours: check.data.hours ?? '', sortOrder: check.data.sortOrder ?? 0 };
    setBusy(true);
    setError(null);
    try {
      if (pointId === 'new') await api.post('/admin/pickup-points', body);
      else await api.put(`/admin/pickup-points/${pointId}`, body);
      onSaved();
    } catch (err) {
      setError(isAxiosError(err) && err.response?.status === 400 ? t('pointInvalid') : t('pointSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="point-name">{t('pointName')}</Label>
        <Input id="point-name" maxLength={120} value={draft.name} onChange={(e) => change({ name: e.target.value })} required {...invalidProps(issues, 'name', 'point-name-error')} />
        <FieldError id="point-name-error" issue={issues.name} className="text-destructive" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="point-city">{t('pointCity')}</Label>
        <Input id="point-city" maxLength={80} value={draft.city} onChange={(e) => change({ city: e.target.value })} required {...invalidProps(issues, 'city', 'point-city-error')} />
        <FieldError id="point-city-error" issue={issues.city} className="text-destructive" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="point-address">{t('pointAddress')}</Label>
        <Input id="point-address" maxLength={200} value={draft.address} onChange={(e) => change({ address: e.target.value })} required {...invalidProps(issues, 'address', 'point-address-error')} />
        <FieldError id="point-address-error" issue={issues.address} className="text-destructive" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="point-hours">{t('pointHours')}</Label>
        <Input
          id="point-hours"
          maxLength={200}
          placeholder={t('pointHoursPlaceholder')}
          value={draft.hours}
          onChange={(e) => change({ hours: e.target.value })}
          {...invalidProps(issues, 'hours', 'point-hours-error')}
        />
        <FieldError id="point-hours-error" issue={issues.hours} className="text-destructive" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="point-sort">{t('pointSort')}</Label>
        <Input
          id="point-sort"
          type="number"
          min={0}
          dir="ltr"
          value={draft.sortOrder}
          onChange={(e) => change({ sortOrder: e.target.value })}
          {...invalidProps(issues, 'sortOrder', 'point-sort-error')}
        />
        <FieldError id="point-sort-error" issue={issues.sortOrder} className="text-destructive" />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => change({ isActive: e.target.checked })}
          className="accent-ocean-700"
        />
        {t('pointActive')}
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy} className="gap-1.5 bg-ocean-700 text-white hover:bg-ocean-800">
          <Check size={14} /> {busy ? t('saving') : t('savePoint')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
