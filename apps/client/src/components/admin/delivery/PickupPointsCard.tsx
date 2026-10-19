'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Notice } from '@/components/admin/common/NoticeBanner';
import { PickupPointForm } from './PickupPointForm';
import { PickupPointRow } from './PickupPointRow';
import { pointDraft, type PickupPoint, type PointEditing } from './types';

const TH = 'px-3 py-2.5 font-medium text-muted-foreground';
const COLUMNS = ['pointName', 'pointCity', 'pointHours', 'pointStatus'] as const;

type Props = {
  /** Null while loading. */
  points: PickupPoint[] | null;
  onChanged: () => void;
  onNotice: (notice: Notice) => void;
};

/** Pickup points table with inline add / edit forms. */
export function PickupPointsCard({ points, onChanged, onNotice }: Props) {
  const t = useTranslations('admin.delivery');
  const [editing, setEditing] = useState<PointEditing>(null);

  const form = (point: PickupPoint | null) => (
    <PickupPointForm
      key={point?.id ?? 'new'}
      pointId={point?.id ?? 'new'}
      initialDraft={pointDraft(point, points?.length ?? 0)}
      onSaved={() => {
        setEditing(null);
        onChanged();
      }}
      onCancel={() => setEditing(null)}
    />
  );

  const toggleActive = async (point: PickupPoint) => {
    try {
      await api.put(`/admin/pickup-points/${point.id}`, { isActive: !point.isActive });
      onChanged();
    } catch {
      onNotice({ kind: 'error', text: t('pointSaveFailed') });
    }
  };

  const remove = async (point: PickupPoint) => {
    if (!window.confirm(t('confirmDelete', { name: point.name }))) return;
    try {
      await api.delete(`/admin/pickup-points/${point.id}`);
      onChanged();
    } catch {
      onNotice({ kind: 'error', text: t('pointDeleteFailed') });
    }
  };

  return (
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
          <Button type="button" size="sm" onClick={() => setEditing('new')} className="gap-1.5 bg-ocean-700 text-white hover:bg-ocean-800">
            <Plus size={14} /> {t('addPoint')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editing === 'new' && form(null)}
        {!points ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : points.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noPoints')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  {COLUMNS.map((column) => (
                    <th key={column} className={`${TH} text-start`}>
                      {t(column)}
                    </th>
                  ))}
                  <th className={`${TH} text-end`}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) =>
                  editing === point.id ? (
                    <tr key={point.id} className="border-b border-border">
                      <td colSpan={5} className="py-3">
                        {form(point)}
                      </td>
                    </tr>
                  ) : (
                    <PickupPointRow
                      key={point.id}
                      point={point}
                      onToggleActive={toggleActive}
                      onEdit={(p) => setEditing(p.id)}
                      onDelete={remove}
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
