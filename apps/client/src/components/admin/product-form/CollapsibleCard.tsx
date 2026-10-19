'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** A form card whose header toggles its body (open by default). */
export function CollapsibleCard({
  title,
  contentClassName,
  children,
}: {
  title: ReactNode;
  contentClassName: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardHeader className="pb-0">
        <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between" aria-expanded={open}>
          <CardTitle className="font-serif text-lg">{title}</CardTitle>
          {open ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
        </button>
      </CardHeader>
      {open && <CardContent className={contentClassName}>{children}</CardContent>}
    </Card>
  );
}
