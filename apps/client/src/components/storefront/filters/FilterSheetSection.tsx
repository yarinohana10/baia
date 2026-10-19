import type { ReactNode } from 'react';

/** A titled group of controls inside the phone filter sheet. */
export function FilterSheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-charcoal">{title}</h3>
      {children}
    </section>
  );
}
