import { cn } from '@/lib/utils';
import { localized, type SizeGuideTable } from '@/lib/catalog/size-guides';

type Props = {
  tables: SizeGuideTable[];
  locale: string;
  /** Header of the first column ("Size"). */
  sizeLabel: string;
  /** Sizes to highlight (the product's own sizes in the product-page dialog). */
  highlight?: string[];
  /** Tighter spacing for the dialog. */
  compact?: boolean;
};

/**
 * Size-guide tables: sizes across the top, one row per measurement. The first
 * column stays put while the table scrolls sideways on narrow screens.
 * No hooks, so it renders on the server (guide page) and in the client dialog.
 */
export function SizeGuideTables({ tables, locale, sizeLabel, highlight = [], compact = false }: Props) {
  const marked = new Set(highlight);
  const cell = compact ? 'px-3 py-2' : 'px-3 py-3 sm:px-4';

  return (
    <div className={compact ? 'space-y-5' : 'space-y-8 sm:space-y-10'}>
      {tables.map((table, t) => {
        const title = localized(locale, table.titleHe, table.titleEn);
        const note = localized(locale, table.noteHe, table.noteEn);
        const titleId = `size-table-${t}-${compact ? 'dialog' : 'page'}`;
        return (
          <section key={t} aria-labelledby={titleId} className="border border-ocean-100 bg-white">
            <div className={cn('bg-[#EAF3F9] text-center', compact ? 'px-3 py-2.5' : 'px-4 py-4 sm:py-5')}>
              <h3
                id={titleId}
                className={cn(
                  'font-semibold uppercase text-ocean-700 ltr:tracking-[0.14em]',
                  compact ? 'text-[12px]' : 'text-[14px] sm:text-[16px]',
                )}
              >
                {title}
              </h3>
              {note && <p className="mt-1 text-[12px] text-ocean-700/70">{note}</p>}
            </div>
            <div className="overflow-x-auto" role="region" aria-labelledby={titleId} tabIndex={0}>
              <table className="w-full min-w-max border-collapse text-center text-[13px] tabular-nums sm:text-[14px]">
                <thead>
                  <tr className="border-t border-ocean-100 bg-[#F5F9FC] text-ocean-700">
                    <th scope="col" className={cn(cell, 'sticky start-0 z-10 bg-[#F5F9FC] text-start font-semibold')}>
                      {sizeLabel}
                    </th>
                    {table.columns.map((size) => (
                      <th
                        key={size}
                        scope="col"
                        dir="ltr"
                        className={cn(cell, 'font-semibold', marked.has(size) && 'bg-ocean-50 text-ocean-800')}
                      >
                        {size}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, r) => (
                    <tr key={r} className="border-t border-ocean-100/70">
                      <th scope="row" className={cn(cell, 'sticky start-0 z-10 bg-white text-start font-semibold text-ocean-700')}>
                        {localized(locale, row.labelHe, row.labelEn)}
                      </th>
                      {table.columns.map((size, c) => (
                        <td key={size} dir="ltr" className={cn(cell, 'text-ink', marked.has(size) && 'bg-ocean-50/60')}>
                          {row.values[c] || '–'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
