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
          'inline-flex h-10 items-center gap-1.5 px-2 text-[12px] uppercase ltr:tracking-[0.12em] text-black underline-offset-[6px] transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black data-popup-open:underline',
          active ? 'font-semibold underline decoration-1' : 'hover:opacity-60',
        )}
      >
        {label}
        <ChevronDown size={13} strokeWidth={1.5} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup className="w-80 rounded-none border border-gray-200 bg-white p-5 shadow-xl outline-none transition-[opacity,transform] duration-150 data-starting-style:-translate-y-1 data-starting-style:opacity-0 data-ending-style:opacity-0">
            <Popover.Title className="sr-only">{title}</Popover.Title>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
