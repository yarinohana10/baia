'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Truck } from 'lucide-react';
import { useAdminList } from '@/hooks/admin/useAdminList';
import { useDeliverySettings } from '@/hooks/admin/useDeliverySettings';
import type { ListPage } from '@/hooks/admin/admin-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NoticeBanner, type Notice } from '@/components/admin/common/NoticeBanner';
import { DeliverySettingsForm } from '@/components/admin/delivery/DeliverySettingsForm';
import { PickupPointsCard } from '@/components/admin/delivery/PickupPointsCard';
import type { PickupPoint } from '@/components/admin/delivery/types';

const selectPoints = (data: PickupPoint[]): ListPage<PickupPoint> => ({
  items: data,
  total: data.length,
  totalPages: 1,
  meta: undefined,
});

export default function AdminDeliveryPage() {
  const t = useTranslations('admin.delivery');
  const { settings, loadFailed, change } = useDeliverySettings();
  const points = useAdminList({ url: '/admin/pickup-points', select: selectPoints });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [settingsErrorDismissed, setSettingsErrorDismissed] = useState(false);

  const loadNotice: Notice | null =
    loadFailed && !settingsErrorDismissed
      ? { kind: 'error', text: t('loadFailed') }
      : points.error
        ? { kind: 'error', text: t('pointsLoadFailed') }
        : null;
  const shownNotice = notice ?? loadNotice;

  const dismissNotice = () => {
    setNotice(null);
    setSettingsErrorDismissed(true);
    points.dismissError();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {shownNotice && <NoticeBanner notice={shownNotice} onDismiss={dismissNotice} dismissLabel={t('dismiss')} />}

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
            <DeliverySettingsForm settings={settings} onChange={change} onNotice={setNotice} />
          )}
        </CardContent>
      </Card>

      <PickupPointsCard points={points.loaded ? points.items : null} onChanged={points.reload} onNotice={setNotice} />
    </div>
  );
}
