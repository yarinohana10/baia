import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/** A spinner while `busy`, otherwise the button's own icon. */
export function BusyIcon({ busy, icon }: { busy: boolean; icon: ReactNode }) {
  return busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : icon;
}
