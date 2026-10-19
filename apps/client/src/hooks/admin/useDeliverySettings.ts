'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { settingsFromConfig, type DeliverySettings } from '@/components/admin/delivery/types';

/** Delivery settings from the site config as editable form strings (null while loading). */
export function useDeliverySettings() {
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/admin/site-config').then(
      (res) => !cancelled && setSettings(settingsFromConfig(res.data)),
      () => !cancelled && setLoadFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const change = useCallback(
    (field: keyof DeliverySettings, value: string) => setSettings((s) => (s ? { ...s, [field]: value } : s)),
    [],
  );

  return { settings, loadFailed, change };
}
