export type HBarRow = {
  key: string;
  label: string;
  /** Secondary text under the label. */
  sublabel?: string;
  value: number;
  /** The value as shown, e.g. "₪1,200". */
  valueLabel: string;
  /** Muted text under the value. */
  note?: string;
};

/** Horizontal bars scaled to the largest row; one hue, the label carries identity. */
export function HBarList({ rows, color }: { rows: HBarRow[]; color: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-body text-sm text-foreground">
              {row.label}
              {row.sublabel && <span className="ms-2 text-xs text-muted-foreground">{row.sublabel}</span>}
            </span>
            <span className="shrink-0 font-body text-sm font-semibold text-foreground">{row.valueLabel}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${Math.max((row.value / max) * 100, row.value > 0 ? 1.5 : 0)}%`, backgroundColor: color }} />
          </div>
          {row.note && <p className="mt-0.5 font-body text-xs text-muted-foreground">{row.note}</p>}
        </li>
      ))}
    </ul>
  );
}
