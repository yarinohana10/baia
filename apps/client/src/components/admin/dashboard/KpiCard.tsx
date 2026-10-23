import type { ComponentType } from 'react';
import { useLocale } from 'next-intl';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatPercent } from '@/lib/admin/analytics-range';
import { Card, CardContent } from '@/components/ui/card';

type KpiCardProps = {
  title: string;
  value: string;
  /** Second line under the value (what the figure is made of). */
  sub?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** % change against the previous period; null/undefined = nothing to compare. */
  change?: number | null;
  /** "was {value}" text next to the change. */
  previousLabel?: string;
  /** For measures where a rise is bad (cancellations). */
  risingIsBad?: boolean;
};

function DeltaBadge({ change, risingIsBad }: { change: number; risingIsBad: boolean }) {
  const locale = useLocale();
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  const good = change === 0 ? null : change > 0 !== risingIsBad;
  const tone = good === null ? 'bg-muted text-muted-foreground' : good ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
  // Direction is carried by the icon and the sign, never by colour alone.
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-body text-xs font-medium ${tone}`}>
      <Icon size={12} aria-hidden="true" />
      <span dir="ltr">{formatPercent(change, locale)}</span>
    </span>
  );
}

export function KpiCard({ title, value, sub, icon: Icon, change, previousLabel, risingIsBad = false }: KpiCardProps) {
  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-ocean-700">
            <Icon size={18} />
          </div>
        </div>
        <p className="font-body text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
        <p className="mt-1 font-serif text-3xl text-foreground">{value}</p>
        {sub && <p className="mt-1 font-body text-xs text-muted-foreground">{sub}</p>}
        {change !== undefined && change !== null && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-xs text-muted-foreground">
            <DeltaBadge change={change} risingIsBad={risingIsBad} />
            {previousLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
