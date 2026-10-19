'use client';

import type { ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  title: string;
  active: boolean;
  children: ReactNode;
};

/** Desktop toolbar dropdown holding one filter's controls. */
export function FilterPopover({ label, title, active, children }: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-600 data-popup-open:border-ocean-700',
          active ? 'border-ocean-700 bg-ocean-50 text-ocean-800' : 'border-gray-300 text-charcoal hover:border-ocean-500',
        )}
      >
        {label}
        <ChevronDown size={14} aria-hidden="true" className="text-gray-500" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup className="w-80 rounded-xl border border-gray-200 bg-white p-5 shadow-xl outline-none transition-[opacity,transform] duration-150 data-starting-style:-translate-y-1 data-starting-style:opacity-0 data-ending-style:opacity-0">
            <Popover.Title className="sr-only">{title}</Popover.Title>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
