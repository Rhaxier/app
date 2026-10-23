// CSV files: turning rows into a file the browser saves (exports, templates),
// and reading a file someone chose (the people import).

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

/**
 * Reads CSV text into rows of cells. Handles quoted cells ("Smith, Jo"),
 * doubled quotes inside them, Windows and Unix line ends, a byte-order mark
 * at the start (Excel adds one), and drops blank lines.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cellText = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cellText += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cellText += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cellText);
      cellText = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cellText);
      rows.push(row);
      row = [];
      cellText = '';
    } else {
      cellText += char;
    }
  }
  row.push(cellText);
  rows.push(row);
  return rows.filter((cells) => cells.some((c) => c.trim() !== ''));
}

/**
 * CSV text → one object per row, keyed by the (lower-case) header row:
 *   "name,email\nJo,jo@…" → [{ name: 'Jo', email: 'jo@…' }]
 */
export function csvToObjects(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rows.map((cells) =>
    Object.fromEntries(keys.map((key, index) => [key, (cells[index] ?? '').trim()])),
  );
}
