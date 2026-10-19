import { Link } from '@/i18n/navigation';
import { clearFilters, listingHref, type ListingQuery } from '@/lib/catalog/query';
import { localizedName } from '@/lib/catalog/names';
import type { Category } from '@/lib/catalog/types';

type Props = {
  basePath: string;
  query: ListingQuery;
  /** Sub-categories as pills, after an "All" pill. */
  items: Category[];
  activeId: string | undefined;
  locale: string;
  label: string;
  allLabel: string;
};

const PILL = 'px-4 py-1.5 text-sm border rounded-lg transition-colors';
const pillClass = (active: boolean) =>
  `${PILL} inline-block ${active ? 'border-ocean-700 bg-ocean-700 text-white' : 'border-gray-300 hover:border-ocean-500'}`;

/** Sub-category pills for a category listing; picking one keeps the sort but clears filters. */
export function SubcategoryNav({ basePath, query, items, activeId, locale, label, allLabel }: Props) {
  const base = clearFilters(query);
  return (
    <nav aria-label={label} className="mb-8">
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link
            href={listingHref(basePath, { ...base, type: undefined })}
            aria-current={!activeId ? 'page' : undefined}
            className={pillClass(!activeId)}
          >
            {allLabel}
          </Link>
        </li>
        {items.map((child) => (
          <li key={child.id}>
            <Link
              href={listingHref(basePath, { ...base, type: child.slug })}
              aria-current={activeId === child.id ? 'page' : undefined}
              className={pillClass(activeId === child.id)}
            >
              {localizedName(child, locale)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
