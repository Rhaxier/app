// Turning rows into a CSV file and handing it to the browser to save
// (used by the SUPW hours export).

/** One CSV cell: quoted if it contains a comma, quote or line break. */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(
  rows: T[],
  columns: { header: string; value: (row: T) => unknown }[],
): string {
  const lines = [columns.map((column) => cell(column.header)).join(',')];
  for (const row of rows) lines.push(columns.map((column) => cell(column.value(row))).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function downloadCsv(filename: string, csv: string): void {
  // The BOM tells Excel the file is UTF-8, so names with accents survive.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
