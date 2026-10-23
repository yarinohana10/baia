import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatCount } from '@/lib/admin/analytics-format';
import { formatWholeShekels } from '@/lib/admin/format';
import { useOrderStatusLabel } from '@/hooks/admin/useOrderStatusLabel';
import { STATUS_COLORS } from './constants';
import type { StatusRow } from './types';

/** Orders placed in the range by their current status; each row opens the orders list on that status. */
export function OrdersByStatusChart({ data }: { data: StatusRow[] }) {
  const locale = useLocale();
  const statusLabel = useOrderStatusLabel();
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;

  return (
    <ul className="space-y-3">
      {data.map((item) => (
        <li key={item.status}>
          <Link href={`/admin/orders?status=${item.status}`} className="block rounded-md hover:bg-muted/50">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="font-body text-xs text-muted-foreground">{statusLabel(item.status)}</span>
              <span className="font-body text-xs font-semibold text-foreground">
                {formatCount(item.count, locale)}
                <span className="ms-2 font-normal text-muted-foreground">{formatWholeShekels(item.value)}</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full"
                style={{ width: `${(item.count / total) * 100}%`, backgroundColor: STATUS_COLORS[item.status] || '#6b7280' }}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
