'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Save, Upload, Image as ImageIcon, Truck, Info } from 'lucide-react';

type SiteConfig = {
  id: string;
  shippingCost: number;
  freeShippingThreshold: number;
  heroImageUrl: string | null;
  heroTitleHe: string | null;
  heroTitleEn: string | null;
  heroSubtitleHe: string | null;
  heroSubtitleEn: string | null;
  heroCtaUrl: string | null;
};

export default function SettingsPage() {
  const t = useTranslations('admin.settings');
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const heroFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await api.get('/admin/site-config');
        const data = res.data;
        setConfig({
          ...data,
          shippingCost: Number(data.shippingCost),
          freeShippingThreshold: Number(data.freeShippingThreshold),
        });
      } catch {
        setMessage({ type: 'error', text: t('loadFailed') });
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, [t]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/admin/site-config', {
        shippingCost: config.shippingCost,
        freeShippingThreshold: config.freeShippingThreshold,
        heroTitleHe: config.heroTitleHe,
        heroTitleEn: config.heroTitleEn,
        heroSubtitleHe: config.heroSubtitleHe,
        heroSubtitleEn: config.heroSubtitleEn,
        heroCtaUrl: config.heroCtaUrl,
      });
      setMessage({ type: 'success', text: t('savedSuccess') });
    } catch {
      setMessage({ type: 'error', text: t('saveFailed') });
    } finally {
      setSaving(false);
    }
  }

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHero(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/admin/site-config/hero-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setConfig((prev) =>
        prev ? { ...prev, heroImageUrl: res.data.heroImageUrl } : prev,
      );
      setMessage({ type: 'success', text: t('heroUploaded') });
    } catch {
      setMessage({ type: 'error', text: t('heroUploadFailed') });
    } finally {
      setUploadingHero(false);
      if (heroFileRef.current) heroFileRef.current.value = '';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="font-body text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="font-body text-sm text-destructive">{t('loadFailed')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[32px] leading-tight text-foreground">{t('title')}</h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-ocean-700 px-6 py-3 text-white hover:bg-ocean-800"
        >
          <Save size={16} />
          {saving ? t('saving') : t('saveChanges')}
        </Button>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-xl px-4 py-3 font-body text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-destructive border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Shipping Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Truck size={18} className="text-ocean-700" />
              <CardTitle className="font-serif text-xl">{t('shipping')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="shippingCost" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('shippingCost')}
              </Label>
              <Input
                id="shippingCost"
                type="number"
                step="0.01"
                value={config.shippingCost}
                onChange={(e) =>
                  setConfig({ ...config, shippingCost: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="freeShippingThreshold" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('freeShippingThreshold')}
              </Label>
              <Input
                id="freeShippingThreshold"
                type="number"
                step="1"
                value={config.freeShippingThreshold}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    freeShippingThreshold: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <p className="font-body text-xs text-muted-foreground">
                {t('freeShippingNote')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Hero Banner */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImageIcon size={18} className="text-ocean-700" />
              <CardTitle className="font-serif text-xl">{t('heroBanner')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              {config.heroImageUrl ? (
                <div className="relative h-40 w-full overflow-hidden rounded-lg">
                  <Image
                    src={config.heroImageUrl}
                    alt="Hero banner"
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg bg-muted">
                  <p className="font-body text-sm text-muted-foreground">{t('noHeroImage')}</p>
                </div>
              )}
            </div>

            <input
              ref={heroFileRef}
              id="heroImageUpload"
              type="file"
              accept="image/*"
              onChange={handleHeroUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => heroFileRef.current?.click()}
              disabled={uploadingHero}
              aria-label="Upload hero image"
              className="w-full gap-2 border-dashed text-muted-foreground hover:border-ocean-700 hover:text-ocean-700"
            >
              <Upload size={16} />
              {uploadingHero ? t('uploading') : t('uploadHeroImage')}
            </Button>
          </CardContent>
        </Card>

        {/* Hero Text (Hebrew) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info size={18} className="text-ocean-700" />
              <CardTitle className="font-serif text-xl">{t('heroTextHe')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="heroTitleHe" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('titleHe')}
              </Label>
              <Input
                id="heroTitleHe"
                type="text"
                dir="rtl"
                value={config.heroTitleHe || ''}
                onChange={(e) => setConfig({ ...config, heroTitleHe: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="heroSubtitleHe" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('subtitleHe')}
              </Label>
              <Input
                id="heroSubtitleHe"
                type="text"
                dir="rtl"
                value={config.heroSubtitleHe || ''}
                onChange={(e) => setConfig({ ...config, heroSubtitleHe: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Hero Text (English) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info size={18} className="text-ocean-700" />
              <CardTitle className="font-serif text-xl">{t('heroTextEn')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="heroTitleEn" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('titleEn')}
              </Label>
              <Input
                id="heroTitleEn"
                type="text"
                value={config.heroTitleEn || ''}
                onChange={(e) => setConfig({ ...config, heroTitleEn: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="heroSubtitleEn" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('subtitleEn')}
              </Label>
              <Input
                id="heroSubtitleEn"
                type="text"
                value={config.heroSubtitleEn || ''}
                onChange={(e) => setConfig({ ...config, heroSubtitleEn: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="heroCtaUrl" className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('ctaLinkUrl')}
              </Label>
              <Input
                id="heroCtaUrl"
                type="text"
                value={config.heroCtaUrl || ''}
                onChange={(e) => setConfig({ ...config, heroCtaUrl: e.target.value })}
                placeholder="/category/men"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
