import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, label, locale }: { items: Crumb[]; label: string; locale: string }) {
  const Chevron = locale === 'he' ? ChevronLeft : ChevronRight;
  return (
    <nav aria-label={label} className="text-[13px] text-gray-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={`${item.href ?? ''}|${item.label}`} className="flex items-center gap-1.5">
            {i > 0 && <Chevron size={12} aria-hidden="true" className="text-gray-300" />}
            {item.href && i < items.length - 1 ? (
              <Link href={item.href} className="hover:text-neutral-700 hover:underline underline-offset-4">
                {item.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined} className="text-gray-900">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
