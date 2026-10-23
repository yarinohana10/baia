export type CsvCell = string | number | null | undefined;

/** One CSV field: quoted when needed, and defanged when a spreadsheet would read text as a formula. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows as a CSV Blob with a BOM, so Excel reads Hebrew correctly. */
export function csvBlob(rows: CsvCell[][]): Blob {
  const text = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  return new Blob([`﻿${text}\r\n`], { type: 'text/csv;charset=utf-8' });
}
