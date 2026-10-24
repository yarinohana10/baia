'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  /** The "Back Soon" message. */
  label: string;
  /** When false the child is rendered as-is, with no tooltip. */
  active: boolean;
  className?: string;
  /** Gets the id to put on the control's aria-describedby, and a handler for taps on it. */
  children: (tip: { describedBy: string | undefined; onTap: () => void }) => ReactNode;
};

const TAP_VISIBLE_MS = 2500;

/**
 * Tooltip for a disabled option. Shows on hover and keyboard focus (CSS) and,
 * for touch screens where a tap on a disabled control may not focus it, for a
 * moment after a tap. The control itself should use aria-disabled (not
 * `disabled`) so it stays focusable and announces the tooltip.
 */
export function BackSoonTip({ label, active, className, children }: Props) {
  const id = useId();
  const [tapped, setTapped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!active) return <span className={className}>{children({ describedBy: undefined, onTap: () => undefined })}</span>;

  const onTap = () => {
    setTapped(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTapped(false), TAP_VISIBLE_MS);
  };

  return (
    <span className={cn('group relative inline-flex', className)}>
      {children({ describedBy: id, onTap })}
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute -top-9 start-1/2 z-30 w-max -translate-x-1/2 rounded-none bg-charcoal px-2.5 py-1 text-xs font-medium text-white shadow-md rtl:translate-x-1/2',
          'hidden group-hover:block group-focus-within:block',
          tapped && 'block',
        )}
      >
        {label}
      </span>
    </span>
  );
}
