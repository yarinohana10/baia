type SegmentedToggleProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

/** Small pill toggle that switches what a card shows (not a filter: it never changes other cards). */
export function SegmentedToggle<T extends string>({ label, value, options, onChange }: SegmentedToggleProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-border bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 font-body text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
            o.value === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
