'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { Accessibility, Building2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type BusinessFields = {
  businessName: string;
  companyId: string;
  businessAddress: string;
  businessPhone: string;
  contactEmail: string;
  whatsappNumber: string;
  accessibilityCoordinatorName: string;
  accessibilityCoordinatorPhone: string;
  accessibilityCoordinatorEmail: string;
};

const FIELDS = [
  'businessName',
  'companyId',
  'businessAddress',
  'businessPhone',
  'contactEmail',
  'whatsappNumber',
  'accessibilityCoordinatorName',
  'accessibilityCoordinatorPhone',
  'accessibilityCoordinatorEmail',
] as const satisfies readonly (keyof BusinessFields)[];

type ApiFieldError = { field: string; code: string };

function errorKey(err: unknown): 'invalidEmail' | 'invalidWhatsapp' | 'requiredField' | 'textTooLong' | 'businessSaveFailed' {
  const errors: ApiFieldError[] = (isAxiosError(err) && err.response?.data?.errors) || [];
  if (errors.some((e) => e.field === 'whatsappNumber')) return 'invalidWhatsapp';
  if (errors.some((e) => e.code === 'isEmail')) return 'invalidEmail';
  if (errors.some((e) => e.code === 'isNotEmpty')) return 'requiredField';
  if (errors.some((e) => e.code === 'maxLength')) return 'textTooLong';
  return 'businessSaveFailed';
}

/**
 * "פרטי העסק" section of the admin settings: business details for the footer,
 * contact page and legal pages, plus the accessibility coordinator.
 */
export function BusinessDetailsCard() {
  const t = useTranslations('admin.settings');
  const [values, setValues] = useState<BusinessFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/site-config')
      .then((res) => {
        if (cancelled) return;
        const data = res.data as Record<string, unknown>;
        const next = {} as BusinessFields;
        for (const key of FIELDS) next[key] = typeof data[key] === 'string' ? (data[key] as string) : '';
        setValues(next);
      })
      .catch(() => !cancelled && setMessage({ type: 'error', text: t('loadFailed') }));
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string | null> = {};
      for (const key of FIELDS) body[key] = values[key].trim();
      body.whatsappNumber = values.whatsappNumber.replace(/\D/g, '') || null;
      await api.put('/admin/site-config', body);
      setValues({ ...values, whatsappNumber: body.whatsappNumber ?? '' });
      setMessage({ type: 'success', text: t('businessSaved') });
      await revalidateCatalog();
    } catch (err) {
      setMessage({ type: 'error', text: t(errorKey(err)) });
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof BusinessFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => (prev ? { ...prev, [key]: e.target.value } : prev));

  const labelClass = 'text-xs uppercase tracking-wide text-muted-foreground';
  const hintClass = 'font-body text-xs text-muted-foreground';

  const field = (
    key: keyof BusinessFields,
    opts: { label: string; type?: string; dir?: 'ltr' | 'rtl'; required?: boolean; hint?: string; placeholder?: string; inputMode?: 'numeric' | 'tel' | 'email' },
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`biz-${key}`} className={labelClass}>
        {opts.label}
      </Label>
      <Input
        id={`biz-${key}`}
        type={opts.type ?? 'text'}
        dir={opts.dir}
        required={opts.required}
        inputMode={opts.inputMode}
        placeholder={opts.placeholder}
        value={values?.[key] ?? ''}
        onChange={set(key)}
        aria-describedby={opts.hint ? `biz-${key}-hint` : undefined}
      />
      {opts.hint && (
        <p id={`biz-${key}-hint`} className={hintClass}>
          {opts.hint}
        </p>
      )}
    </div>
  );

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-ocean-700" />
          <CardTitle className="font-serif text-xl">{t('business')}</CardTitle>
        </div>
        <p className="font-body text-sm text-muted-foreground">{t('businessDescription')}</p>
      </CardHeader>
      <CardContent>
        {!values ? (
          <p className="font-body text-sm text-muted-foreground">{message?.text ?? t('loading')}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {field('businessName', { label: t('businessName'), required: true })}
              {field('companyId', { label: t('companyId'), required: true, dir: 'ltr', inputMode: 'numeric', hint: t('companyIdHint') })}
              {field('businessAddress', { label: t('businessAddress'), required: true })}
              {field('businessPhone', { label: t('businessPhone'), required: true, type: 'tel', dir: 'ltr' })}
              {field('contactEmail', { label: t('contactEmail'), required: true, type: 'email', dir: 'ltr', hint: t('contactEmailHint') })}
              {field('whatsappNumber', {
                label: t('whatsappNumber'),
                dir: 'ltr',
                inputMode: 'numeric',
                placeholder: '972501234567',
                hint: t('whatsappHint'),
              })}
            </div>

            <fieldset className="rounded-lg border border-border p-4">
              <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
                <Accessibility size={16} className="text-ocean-700" aria-hidden="true" />
                {t('accessibilityCoordinator')}
              </legend>
              <p className={`${hintClass} mb-3`}>{t('accessibilityHint')}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {field('accessibilityCoordinatorName', { label: t('a11yName'), required: true })}
                {field('accessibilityCoordinatorPhone', { label: t('a11yPhone'), required: true, type: 'tel', dir: 'ltr' })}
                {field('accessibilityCoordinatorEmail', { label: t('a11yEmail'), required: true, type: 'email', dir: 'ltr' })}
              </div>
            </fieldset>

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

            <Button type="submit" disabled={saving} className="gap-2 bg-ocean-700 px-6 py-3 text-white hover:bg-ocean-800">
              <Save size={16} />
              {saving ? t('saving') : t('saveBusiness')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
