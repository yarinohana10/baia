import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="mb-1 text-xs font-medium text-muted-foreground font-body">
      {children} <span className="text-destructive">*</span>
    </Label>
  );
}
