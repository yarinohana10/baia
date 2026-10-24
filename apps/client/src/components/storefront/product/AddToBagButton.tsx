'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  purchasable: boolean;
  adding: boolean;
  /** Briefly true after a successful add (shows a check mark). */
  added: boolean;
  onAdd: () => void;
};

/** The main "Add to bag" button. */
export function AddToBagButton({ label, purchasable, adding, added, onAdd }: Props) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={!purchasable || adding}
      aria-busy={adding}
      className={cn(
        'flex h-12 flex-1 items-center justify-center gap-2 text-[12px] font-medium uppercase ltr:tracking-[0.16em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
        purchasable ? 'bg-black text-white hover:bg-black/85 disabled:opacity-70' : 'cursor-not-allowed bg-neutral-200 text-black/45',
      )}
    >
      {added ? <Check size={16} aria-hidden="true" /> : null}
      {label}
    </button>
  );
}
