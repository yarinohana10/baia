'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

/**
 * "Store access" section of the admin settings: the Coming Soon switch. While on,
 * shoppers see only the Coming Soon page; Admins keep seeing the whole store.
 * Saves on toggle, and asks before opening the store to everyone.
 */
export function StoreAccessCard() {
  const t = useTranslations('admin.settings');
  const [comingSoon, setComingSoon] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/site-config')
      .then((res) => !cancelled && setComingSoon(res.data.comingSoon === true))
      .catch(() => !cancelled && setMessage({ type: 'error', text: t('loadFailed') }));
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function toggle() {
    if (comingSoon === null || saving) return;
    const next = !comingSoon;
    if (!next && !window.confirm(t('comingSoonConfirmOff'))) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.put('/admin/site-config', { comingSoon: next });
      setComingSoon(res.data.comingSoon === true);
      setMessage({ type: 'success', text: t(next ? 'comingSoonEnabled' : 'comingSoonDisabled') });
    } catch {
      setMessage({ type: 'error', text: t('comingSoonSaveFailed') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={comingSoon ? 'border-amber-300' : undefined}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-ocean-700" />
          <CardTitle className="font-serif text-xl">{t('storeAccess')}</CardTitle>
        </div>
        <p className="font-body text-sm text-muted-foreground">{t('storeAccessDescription')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {comingSoon === null ? (
          <p className="font-body text-sm text-muted-foreground">{message?.text ?? t('loading')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
              <div className="min-w-0">
                <p id="coming-soon-label" className="font-body text-sm font-medium text-foreground">
                  {t('comingSoonLabel')}
                </p>
                <p id="coming-soon-state" className="mt-0.5 font-body text-xs text-muted-foreground">
                  {t(comingSoon ? 'comingSoonOn' : 'comingSoonOff')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={comingSoon}
                aria-labelledby="coming-soon-label"
                aria-describedby="coming-soon-state"
                disabled={saving}
                onClick={toggle}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-700 disabled:opacity-60 ${
                  comingSoon ? 'bg-ocean-700' : 'bg-neutral-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                    comingSoon ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'
                  }`}
                />
              </button>
            </div>

            {comingSoon && (
              <Link
                href="/coming-soon"
                target="_blank"
                className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-ocean-700 hover:underline"
              >
                <ExternalLink size={14} />
                {t('comingSoonPreview')}
              </Link>
            )}

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
          </>
        )}
      </CardContent>
    </Card>
  );
}
