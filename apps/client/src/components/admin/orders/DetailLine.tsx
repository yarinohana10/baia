import type { ReactNode } from 'react';

/** `Label: value` line in the order dialog. */
export function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}:</span> {children}
    </p>
  );
}
