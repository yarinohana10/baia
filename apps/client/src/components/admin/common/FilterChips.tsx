'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FilterOption<V extends string> = { value: V; label: string };

/** A row of toggle buttons that filter a list; the selected one is filled. */
export function FilterChips<V extends string>({
  options,
  selected,
  onSelect,
}: {
  options: FilterOption<V>[];
  selected: V;
  onSelect: (value: V) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value || 'all'}
          variant={selected === option.value ? 'default' : 'outline'}
          size="xs"
          onClick={() => onSelect(option.value)}
          className={cn(selected === option.value && 'bg-ocean-700 hover:bg-ocean-800')}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
