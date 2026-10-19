'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AdminCounts } from '@/components/admin/AdminShell';
import type { DashboardData } from '@/components/admin/dashboard/types';
import { loadDashboard } from './dashboard-data';

/**
 * Loads the admin dashboard once on mount. `data` is null while loading;
 * `counts` stays null if the notification counts request fails.
 */
export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [counts, setCounts] = useState<AdminCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDashboard().then((result) => {
      if (!cancelled) setData(result);
    });
    api.get<AdminCounts>('/admin/notifications/counts').then(
      (res) => {
        if (!cancelled) setCounts(res.data);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, counts };
}
