'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { Check, MapPin, Pencil, Plus, Trash2, Truck, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deliverySettingsSchema, pickupPointSchema } from '@baia/shared';
import { invalidProps, validateForm, type FieldIssues } from '@/lib/form-errors';
import { FieldError } from '@/components/forms/FieldError';

type DeliverySettings = {
  shippingCost: string;
  pickupPointCost: string;
  freeShippingThreshold: string;
  courierEtaDays: string;
  pickupEtaDays: string;
  selfCancelWindowHours: string;
};

type PickupPoint = {
  id: string;
  name: string;
  city: string;
  address: string;
  hours: string | null;
  isActive: boolean;
  sortOrder: number;
};

type PointDraft = { name: string; city: string; address: string; hours: string; sortOrder: string; isActive: boolean };

const EMPTY_DRAFT: PointDraft = { name: '', city: '', address: '', hours: '', sortOrder: '0', isActive: true };

/** Prices are kept to agorot: extra decimals are rounded, as before, rather than rejected. */
const roundAmount = (v: string) => {
  const n = Number(v);
  return v.trim() === '' || !Number.isFinite(n) ? v : Math.round(n * 100) / 100;
};

type Notice = { kind: 'success' | 'error'; text: string } | null;

export default function AdminDeliveryPage() {
  const t = useTranslations('admin.delivery');
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [points, setPoints] = useState<PickupPoint[] | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<PointDraft>(EMPTY_DRAFT);
  const [pointError, setPointError] = useState<string | null>(null);
  const [pointBusy, setPointBusy] = useState(false);
  const [pointIssues, setPointIssues] = useState<FieldIssues>({});

  useEffect(() => {
    api
      .get('/admin/site-config')
      .then((res) => {
        const d = res.data;
        setSettings({
          shippingCost: String(Number(d.shippingCost ?? 29.9)),
          pickupPointCost: String(Number(d.pickupPointCost ?? 19.9)),
          freeShippingThreshold: String(Number(d.freeShippingThreshold ?? 249)),
          courierEtaDays: d.courierEtaDays ?? '3-5',
          pickupEtaDays: d.pickupEtaDays ?? '2-4',
          selfCancelWindowHours: String(d.selfCancelWindowHours ?? 48),
        });
      })
      .catch(() => setNotice({ kind: 'error', text: t('loadFailed') }));
  }, [t]);

  const loadPoints = useCallback(() => {
    api
      .get<PickupPoint[]>('/admin/pickup-points')
      .then((res) => setPoints(res.data))
      .catch(() => setNotice({ kind: 'error', text: t('pointsLoadFailed') }));
  }, [t]);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  // Validated live (the shared schema converts the form strings to the API's numbers).
  const settingsCheck = settings
    ? validateForm(deliverySettingsSchema, {
        ...settings,
        shippingCost: roundAmount(settings.shippingCost),
        pickupPointCost: roundAmount(settings.pickupPointCost),
        freeShippingThreshold: roundAmount(settings.freeShippingThreshold),
      })
    : null;
  const settingsValid = !!settingsCheck?.success;
  const settingsIssues: FieldIssues = settingsCheck?.errors ?? {};

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!settingsCheck?.success || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.put('/admin/site-config', settingsCheck.data);
      await revalidateCatalog();
      setNotice({ kind: 'success', text: t('saved') });
    } catch {
      setNotice({ kind: 'error', text: t('saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (point: PickupPoint | null) => {
    setPointError(null);
    setPointIssues({});
    if (point) {
      setEditing(point.id);
      setDraft({
        name: point.name,
        city: point.city,
        address: point.address,
        hours: point.hours ?? '',
        sortOrder: String(point.sortOrder),
        isActive: point.isActive,
      });
    } else {
      setEditing('new');
      setDraft({ ...EMPTY_DRAFT, sortOrder: String(((points?.length ?? 0) + 1) * 10) });
    }
  };

  const savePoint = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || pointBusy) return;
    const check = validateForm(pickupPointSchema, draft);
    setPointIssues(check.errors);
    if (!check.success) {
      const missing = (['name', 'city', 'address'] as const).some((f) => check.errors[f]?.key === 'validation.required');
      setPointError(missing ? t('pointRequiredFields') : t('pointInvalid'));
      return;
    }
    // Blank hours clear the field; a blank sort order means 0.
    const body = { ...check.data, hours: check.data.hours ?? '', sortOrder: check.data.sortOrder ?? 0 };
    setPointBusy(true);
    setPointError(null);
    try {
      if (editing === 'new') await api.post('/admin/pickup-points', body);
      else await api.put(`/admin/pickup-points/${editing}`, body);
      setEditing(null);
      loadPoints();
    } catch (err) {
      setPointError(isAxiosError(err) && err.response?.status === 400 ? t('pointInvalid') : t('pointSaveFailed'));
    } finally {
      setPointBusy(false);
    }
  };

  const toggleActive = async (point: PickupPoint) => {
    try {
      await api.put(`/admin/pickup-points/${point.id}`, { isActive: !point.isActive });
      loadPoints();
    } catch {
      setNotice({ kind: 'error', text: t('pointSaveFailed') });
    }
  };

  const removePoint = async (point: PickupPoint) => {
    if (!window.confirm(t('confirmDelete', { name: point.name }))) return;
    try {
      await api.delete(`/admin/pickup-points/${point.id}`);
      loadPoints();
    } catch {
      setNotice({ kind: 'error', text: t('pointDeleteFailed') });
    }
  };

  const field = (key: keyof DeliverySettings, label: string, opts: { hint?: string; suffix?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={`delivery-${key}`} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {/* LTR wrapper so the suffix sits on the same side as the input's end padding. */}
      <div className="relative" dir="ltr">
        <Input
          id={`delivery-${key}`}
          dir="ltr"
          inputMode={key.endsWith('EtaDays') ? 'text' : 'decimal'}
          value={settings?.[key] ?? ''}
          onChange={(e) => setSettings((s) => (s ? { ...s, [key]: e.target.value } : s))}
          aria-invalid={!!settingsIssues[key]}
          aria-describedby={settingsIssues[key] ? `delivery-${key}-error` : undefined}
          className={cn(opts.suffix && 'pe-14')}
        />
        {opts.suffix && (
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {opts.suffix}
          </span>
        )}
      </div>
      <FieldError id={`delivery-${key}-error`} issue={settingsIssues[key]} className="text-destructive" />
      {opts.hint && <p className="text-xs text-muted-foreground">{opts.hint}</p>}
    </div>
  );

  const pointForm = (
    <form onSubmit={savePoint} className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="point-name">{t('pointName')}</Label>
        <Input id="point-name" maxLength={120} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required {...invalidProps(pointIssues, 'name', 'point-name-error')} />
        <FieldError id="point-name-error" issue={pointIssues.name} className="text-destructive" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="point-city">{t('pointCity')}</Label>
        <Input id="point-city" maxLength={80} value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} required {...invalidProps(pointIssues, 'city', 'point-city-error')} />
        <FieldError id="point-city-error" issue={pointIssues.city} className="text-destructive" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="point-address">{t('pointAddress')}</Label>
        <Input id="point-address" maxLength={200} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} required {...invalidProps(pointIssues, 'address', 'point-address-error')} />
        <FieldError id="point-address-error" issue={pointIssues.address} className="text-destructive" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="point-hours">{t('pointHours')}</Label>
        <Input
          id="point-hours"
          maxLength={200}
          placeholder={t('pointHoursPlaceholder')}
          value={draft.hours}
          onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
          {...invalidProps(pointIssues, 'hours', 'point-hours-error')}
        />
        <FieldError id="point-hours-error" issue={pointIssues.hours} className="text-destructive" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="point-sort">{t('pointSort')}</Label>
        <Input
          id="point-sort"
          type="number"
          min={0}
          dir="ltr"
          value={draft.sortOrder}
          onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
          {...invalidProps(pointIssues, 'sortOrder', 'point-sort-error')}
        />
        <FieldError id="point-sort-error" issue={pointIssues.sortOrder} className="text-destructive" />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
          className="accent-ocean-700"
        />
        {t('pointActive')}
      </label>
      {pointError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive sm:col-span-2">
          {pointError}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pointBusy} className="gap-1.5 bg-ocean-700 text-white hover:bg-ocean-800">
          <Check size={14} /> {pointBusy ? t('saving') : t('savePoint')}
        </Button>
        <Button type="button" variant="outline" onClick={() => setEditing(null)}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm',
            notice.kind === 'error' ? 'bg-red-50 text-destructive' : 'bg-green-50 text-green-700',
          )}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="rounded p-1 opacity-70 hover:opacity-100" aria-label={t('dismiss')}>
            <X size={14} />
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-ocean-700" />
            <CardTitle className="font-serif text-xl">{t('pricesTitle')}</CardTitle>
          </div>
          <CardDescription>{t('pricesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!settings ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : (
            <form onSubmit={saveSettings} className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {field('shippingCost', t('courierPrice'), { suffix: '₪' })}
                {field('pickupPointCost', t('pickupPrice'), { suffix: '₪' })}
                {field('freeShippingThreshold', t('freeThreshold'), {
                  suffix: '₪',
                  hint: t('freeThresholdHint'),
                })}
                {field('courierEtaDays', t('courierEta'), {
                  suffix: t('days'),
                  hint: t('etaHint'),
                })}
                {field('pickupEtaDays', t('pickupEta'), {
                  suffix: t('days'),
                  hint: t('etaHint'),
                })}
                {field('selfCancelWindowHours', t('cancelWindow'), {
                  suffix: t('hours'),
                  hint: t('cancelWindowHint'),
                })}
              </div>
              {!settingsValid && <p className="text-sm text-destructive">{t('invalid')}</p>}
              <Button type="submit" disabled={saving || !settingsValid} className="bg-ocean-700 text-white hover:bg-ocean-800">
                {saving ? t('saving') : t('save')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-ocean-700" />
              <CardTitle className="font-serif text-xl">{t('pointsTitle')}</CardTitle>
            </div>
            <CardDescription className="mt-1">{t('pointsDescription')}</CardDescription>
          </div>
          {editing !== 'new' && (
            <Button type="button" size="sm" onClick={() => startEdit(null)} className="gap-1.5 bg-ocean-700 text-white hover:bg-ocean-800">
              <Plus size={14} /> {t('addPoint')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {editing === 'new' && pointForm}
          {!points ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : points.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('noPoints')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-3 py-2.5 text-start font-medium text-muted-foreground">{t('pointName')}</th>
                    <th className="px-3 py-2.5 text-start font-medium text-muted-foreground">{t('pointCity')}</th>
                    <th className="px-3 py-2.5 text-start font-medium text-muted-foreground">{t('pointHours')}</th>
                    <th className="px-3 py-2.5 text-start font-medium text-muted-foreground">{t('pointStatus')}</th>
                    <th className="px-3 py-2.5 text-end font-medium text-muted-foreground">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) =>
                    editing === point.id ? (
                      <tr key={point.id} className="border-b border-border">
                        <td colSpan={5} className="py-3">
                          {pointForm}
                        </td>
                      </tr>
                    ) : (
                      <tr key={point.id} className={cn('border-b border-border', !point.isActive && 'opacity-60')}>
                        <td className="px-3 py-3">
                          <p className="font-medium text-foreground">{point.name}</p>
                          <p className="text-xs text-muted-foreground">{point.address}</p>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{point.city}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{point.hours || '—'}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => toggleActive(point)}
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-xs',
                              point.isActive ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground',
                            )}
                            aria-label={point.isActive ? t('deactivate', { name: point.name }) : t('activate', { name: point.name })}
                          >
                            {point.isActive ? t('active') : t('inactive')}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEdit(point)}
                            aria-label={t('edit', { name: point.name })}
                            className="text-muted-foreground hover:text-ocean-700"
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removePoint(point)}
                            aria-label={t('delete', { name: point.name })}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
