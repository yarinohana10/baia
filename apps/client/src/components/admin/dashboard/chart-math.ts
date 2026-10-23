/** Round, evenly spaced axis values from 0 up to at least `max` (`count` intervals, steps of 1/2/2.5/5 x 10^n). */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rough = max / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= rough) ?? 10) * pow;
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks.slice(0, ticks.findIndex((t) => t >= max) + 1 || undefined);
}

/** Indexes to label on the x axis: at most `max`, evenly spread, always including the first. */
export function labelIndexes(length: number, max: number): number[] {
  if (length <= 0) return [];
  if (length <= max) return Array.from({ length }, (_, i) => i);
  const step = Math.ceil(length / max);
  return Array.from({ length: Math.ceil(length / step) }, (_, i) => i * step);
}

/** Compact axis value: 1200 -> 1.2k, 2500000 -> 2.5M. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => String(Math.round(n * 10) / 10);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1000) return `${trim(value / 1000)}k`;
  return String(Math.round(value * 100) / 100);
}

/** Index of the band (one per data point) under a pointer at `ratio` (0..1) across the plot. */
export function bandIndex(ratio: number, length: number): number {
  if (length <= 1) return 0;
  return Math.min(length - 1, Math.max(0, Math.floor(ratio * length)));
}

/** The band a key press moves to: arrows step, Home/End jump, Escape clears; null for other keys (ignored). */
export function bandAfterKey(key: string, active: number | null, length: number): number | null | undefined {
  if (key === 'Escape') return null;
  if (key === 'ArrowRight') return Math.min(length - 1, (active ?? -1) + 1);
  if (key === 'ArrowLeft') return Math.max(0, (active ?? length) - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return undefined;
}
