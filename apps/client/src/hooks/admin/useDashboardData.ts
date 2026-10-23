'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { rangeKey, type RangeSelection } from '@/lib/admin/analytics-range';
import type { AdminCounts } from '@/components/admin/AdminShell';
import type { DashboardData } from '@/components/admin/dashboard/types';
import { loadDashboard } from './dashboard-data';

type Loaded = { key: string; data: DashboardData };

/**
 * Loads the dashboard for the selected range (`selection` must be a stable value, e.g. state). `data` keeps the previous result
 * while a new range loads (`loading` is true meanwhile), so the page does not
 * jump; it is null only on the very first load. `reload` re-runs the request.
 * `counts` stays null if the notification counts request fails.
 */
export function useDashboardData(selection: RangeSelection) {
  const key = rangeKey(selection);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [counts, setCounts] = useState<AdminCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDashboard(selection).then((data) => {
      if (!cancelled) setLoaded({ key: `${key}#${attempt}`, data });
    });
    return () => {
      cancelled = true;
    };
  }, [selection, key, attempt]);

  useEffect(() => {
    let cancelled = false;
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

  return {
    data: loaded?.data ?? null,
    loading: loaded?.key !== `${key}#${attempt}`,
    counts,
    reload: () => setAttempt((n) => n + 1),
  };
}
