'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Clock, MapPin, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export type PickupPoint = { id: string; name: string; city: string; address: string; hours: string | null };

let pointsRequest: Promise<PickupPoint[]> | null = null;
function loadPoints(): Promise<PickupPoint[]> {
  pointsRequest ??= api
    .get<PickupPoint[]>('/pickup-points')
    .then((res) => res.data)
    .catch((err) => {
      pointsRequest = null;
      throw err;
    });
  return pointsRequest;
}

/** Searchable list of active pickup points (radio group). */
export function PickupPointPicker({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: PickupPoint | null;
  onChange: (point: PickupPoint) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const t = useTranslations('delivery.picker');
  const [points, setPoints] = useState<PickupPoint[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadPoints()
      .then((list) => !cancelled && setPoints(list))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!points || !q) return points ?? [];
    return points.filter((p) => [p.city, p.name, p.address].some((field) => field.toLowerCase().includes(q)));
  }, [points, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor="pickup-search" className="sr-only">
          {t('searchLabel')}
        </label>
        <Search size={15} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          id="pickup-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          disabled={disabled}
          className="w-full rounded-none border border-gray-300 py-2 ps-9 pe-3 text-sm focus:border-neutral-600 focus:outline-none disabled:bg-gray-50"
        />
      </div>

      {failed ? (
        <p role="alert" className="text-sm text-red-500">{t('loadError')}</p>
      ) : points === null ? (
        <div className="space-y-2 animate-pulse" aria-busy="true">
          <span className="sr-only">{t('loading')}</span>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-none bg-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-none bg-gray-50 px-4 py-3 text-sm text-gray-500">
          {points.length === 0 ? t('noneAvailable') : t('noResults')}
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label={t('listLabel')}
          aria-invalid={invalid || undefined}
          className={cn('max-h-72 space-y-2 overflow-y-auto pe-1', invalid && 'rounded-none ring-1 ring-red-300')}
        >
          {filtered.map((point) => {
            const selected = value?.id === point.id;
            return (
              <button
                key={point.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(point)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-none border p-3 text-start transition-colors disabled:cursor-not-allowed',
                  selected ? 'border-neutral-700 bg-[#F7F7F7]/60' : 'border-gray-200 hover:border-neutral-400',
                )}
              >
                <MapPin size={16} aria-hidden="true" className={cn('mt-0.5 shrink-0', selected ? 'text-black' : 'text-gray-400')} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{point.name}</span>
                  <span className="block text-xs text-gray-500">
                    {point.address}, {point.city}
                  </span>
                  {point.hours && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} aria-hidden="true" /> {point.hours}
                    </span>
                  )}
                </span>
                {selected && <Check size={16} aria-hidden="true" className="shrink-0 text-black" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
