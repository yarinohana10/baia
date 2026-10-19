import type { ClassValue } from 'clsx';
import { cn } from '@/lib/utils';

/** Native `<select>` styled like the shadcn Input (extra classes are merged in). */
export function adminSelectClassName(...extra: ClassValue[]) {
  return cn(
    'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    ...extra,
  );
}
