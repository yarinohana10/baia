'use client';

import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useLocale } from 'next-intl';
import { useElementWidth } from '@/hooks/admin/useElementWidth';
import { formatBucketAxis, formatBucketFull, type Bucket } from '@/lib/admin/analytics-format';
import { bandAfterKey, bandIndex, compactNumber, labelIndexes, niceTicks } from './chart-math';

export type SeriesPoint = { date: string; value: number; detail?: string };

type TimeSeriesChartProps = {
  points: SeriesPoint[];
  bucket: Bucket;
  variant: 'line' | 'bars';
  color: string;
  /** Name of the measure, e.g. "Revenue" (tooltip, table, accessible name). */
  seriesLabel: string;
  formatValue: (value: number) => string;
  /** Names a week from its formatted first day ("Week of 18 Oct 2026"). */
  weekLabel: (date: string) => string;
  dateColumnLabel: string;
};

const HEIGHT = 240;
const PAD = { top: 12, right: 20, bottom: 28, left: 44 };
const MAX_X_LABELS = 7;
const BAR_RADIUS = 4;

/** Bar with a rounded data end (top) and a flat base on the axis. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(BAR_RADIUS, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

type Geometry = {
  width: number;
  plotH: number;
  band: number;
  ticks: number[];
  xAt: (i: number) => number;
  yAt: (v: number) => number;
};

type PlotProps = {
  points: SeriesPoint[];
  geo: Geometry;
  bucket: Bucket;
  variant: 'line' | 'bars';
  color: string;
  active: number | null;
};

function Axes({ points, geo, bucket }: Pick<PlotProps, 'points' | 'geo' | 'bucket'>) {
  const locale = useLocale();
  return (
    <>
      {geo.ticks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={geo.width - PAD.right} y1={geo.yAt(tick)} y2={geo.yAt(tick)} className="stroke-border" strokeWidth={1} />
          <text x={PAD.left - 8} y={geo.yAt(tick) + 4} textAnchor="end" className="fill-muted-foreground font-body text-[11px]">
            {compactNumber(tick)}
          </text>
        </g>
      ))}
      {labelIndexes(points.length, MAX_X_LABELS).map((i) => (
        <text key={points[i].date} x={geo.xAt(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground font-body text-[11px]">
          {formatBucketAxis(points[i].date, bucket, locale)}
        </text>
      ))}
    </>
  );
}

function Marks({ points, geo, variant, color, active }: Omit<PlotProps, 'bucket'>) {
  const n = points.length;
  const { xAt, yAt, band } = geo;
  if (variant === 'bars') {
    const barW = Math.max(2, Math.min(28, band * 0.7));
    return (
      <>
        {active !== null && <rect x={PAD.left + active * band} y={PAD.top} width={band} height={geo.plotH} className="fill-muted" opacity={0.7} />}
        {points.map((p, i) => {
          const h = yAt(0) - yAt(p.value);
          return h > 0 ? <path key={p.date} d={barPath(xAt(i) - barW / 2, yAt(p.value), barW, h)} fill={color} /> : null;
        })}
      </>
    );
  }
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(p.value)}`).join(' ');
  const focus = active ?? (n === 1 ? 0 : null);
  return (
    <>
      {active !== null && <line x1={xAt(active)} x2={xAt(active)} y1={PAD.top} y2={PAD.top + geo.plotH} className="stroke-muted-foreground" strokeWidth={1} />}
      {n > 1 && (
        <>
          <path d={`${linePath} L${xAt(n - 1)},${yAt(0)} L${xAt(0)},${yAt(0)} Z`} fill={color} opacity={0.1} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {focus !== null && <circle cx={xAt(focus)} cy={yAt(points[focus].value)} r={4} fill={color} className="stroke-card" strokeWidth={2} />}
    </>
  );
}

type TooltipProps = {
  point: SeriesPoint;
  title: string;
  x: number;
  width: number;
  color: string;
  seriesLabel: string;
  formatValue: (value: number) => string;
};

function Tooltip({ point, title, x, width, color, seriesLabel, formatValue }: TooltipProps) {
  const locale = useLocale();
  const shift = x > width * 0.65 ? 'translateX(-100%)' : x < width * 0.35 ? 'translateX(0)' : 'translateX(-50%)';
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 min-w-32 rounded-lg border border-border bg-card px-3 py-2 shadow-md"
      style={{ left: x, transform: shift }}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
    >
      <p className="font-body text-xs text-muted-foreground">{title}</p>
      <p className="mt-0.5 flex items-center gap-2 font-body text-sm font-semibold text-foreground">
        <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: color }} aria-hidden="true" />
        {formatValue(point.value)}
        <span className="text-xs font-normal text-muted-foreground">{seriesLabel}</span>
      </p>
      {point.detail && <p className="mt-0.5 font-body text-xs text-muted-foreground">{point.detail}</p>}
    </div>
  );
}

/**
 * One measure over time: a line with a soft area, or bars. Time always runs
 * left to right (also in Hebrew). Hover, touch or the arrow keys read a value;
 * every value is also in the visually hidden table.
 */
export function TimeSeriesChart({ points, bucket, variant, color, seriesLabel, formatValue, weekLabel, dateColumnLabel }: TimeSeriesChartProps) {
  const locale = useLocale();
  const [containerRef, width] = useElementWidth<HTMLDivElement>(640);
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  const n = points.length;
  const plotW = Math.max(width - PAD.left - PAD.right, 40);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const ticks = niceTicks(Math.max(...points.map((p) => p.value), 0));
  const yMax = ticks[ticks.length - 1];
  const band = plotW / Math.max(n, 1);
  const geo: Geometry = {
    width,
    plotH,
    band,
    ticks,
    xAt: (i) => PAD.left + (i + 0.5) * band,
    yAt: (v) => PAD.top + plotH - (v / yMax) * plotH,
  };
  const full = (date: string) => formatBucketFull(date, bucket, locale, weekLabel);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActive(bandIndex((e.clientX - rect.left - PAD.left) / plotW, n));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = bandAfterKey(e.key, active, n);
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
  };

  return (
    <div ref={containerRef} className="relative w-full" dir="ltr">
      <div
        tabIndex={0}
        role="group"
        aria-label={seriesLabel}
        aria-describedby={tableId}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        <svg width={width} height={HEIGHT} aria-hidden="true" className="block touch-pan-y select-none">
          <Axes points={points} geo={geo} bucket={bucket} />
          <Marks points={points} geo={geo} variant={variant} color={color} active={active} />
        </svg>
      </div>

      {active !== null && (
        <Tooltip point={points[active]} title={full(points[active].date)} x={geo.xAt(active)} width={width} color={color} seriesLabel={seriesLabel} formatValue={formatValue} />
      )}

      <table id={tableId} className="sr-only">
        <caption>{seriesLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{dateColumnLabel}</th>
            <th scope="col">{seriesLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{full(p.date)}</th>
              <td>{formatValue(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
