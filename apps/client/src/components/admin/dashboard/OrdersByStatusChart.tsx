import { useTranslations } from 'next-intl';
import { STATUS_COLORS, orderStatusLabelKey } from './constants';
import type { OrderByStatus } from './types';

/** Horizontal bars with each status's share of all orders. */
export function OrdersByStatusChart({ data }: { data: OrderByStatus[] }) {
  const t = useTranslations('admin.orders');
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const labelKey = orderStatusLabelKey(item.status);
        return (
          <div key={item.status}>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-body text-xs text-muted-foreground">
                {labelKey ? t(labelKey) : item.status}
              </span>
              <span className="font-body text-xs font-semibold text-foreground">{item.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(item.count / total) * 100}%`,
                  backgroundColor: STATUS_COLORS[item.status] || '#6b7280',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
