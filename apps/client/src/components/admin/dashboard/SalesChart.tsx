import type { SalesDay } from './types';

const WIDTH = 560;
const HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 28, left: 48 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

function formatAxisValue(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value;
}

/** Revenue line chart, one point per day. */
export function SalesChart({ days }: { days: SalesDay[] }) {
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
  const points = days.map((d, i) => ({
    date: d.date,
    x: PADDING.left + (i / Math.max(days.length - 1, 1)) * CHART_W,
    y: PADDING.top + CHART_H - (d.revenue / maxRevenue) * CHART_H,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? PADDING.left} ${PADDING.top + CHART_H} L ${points[0]?.x ?? PADDING.left} ${PADDING.top + CHART_H} Z`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
      {Y_TICKS.map((tick) => {
        const y = PADDING.top + CHART_H - tick * CHART_H;
        return (
          <g key={tick}>
            <line x1={PADDING.left} y1={y} x2={WIDTH - PADDING.right} y2={y} stroke="#eeeeee" strokeWidth={1} />
            <text x={PADDING.left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px] font-body">
              {formatAxisValue(Math.round(maxRevenue * tick))}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#chartGradient)" opacity={0.3} />
      <path d={linePath} fill="none" stroke="#005d72" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.date} cx={p.x} cy={p.y} r={3} fill="#005d72" />
      ))}
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#005d72" />
          <stop offset="100%" stopColor="#005d72" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}
