import type { ComponentType } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type KpiCardProps = {
  title: string;
  value: string;
  /** Shown as a "+n" badge when positive. */
  trend?: number;
  trendLabel?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

export function KpiCard({ title, value, trend, trendLabel, icon: Icon }: KpiCardProps) {
  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-ocean-700">
            <Icon size={20} />
          </div>
          {trend !== undefined && trend > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <TrendingUp size={12} className="text-ocean-700" />
              <span className="font-body text-xs font-medium text-ocean-700">+{trend}</span>
            </div>
          )}
        </div>
        <p className="font-body text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
        <p className="mt-1 font-serif text-3xl text-foreground">{value}</p>
        {trendLabel && (
          <p className="mt-1 font-body text-xs text-muted-foreground">{trendLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
