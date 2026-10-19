import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/** Labelled input with its error, inside a size row's "more options". */
export function StockRowField({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="mb-0.5 text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
