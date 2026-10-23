import { describe, expect, it } from 'vitest';
import { csvToObjects, parseCsv, toCsv } from './csv';

describe('toCsv', () => {
  it('writes a header row and one line per row', () => {
    const csv = toCsv(
      [{ name: 'Student A', hours: 3 }],
      [
        { header: 'Name', value: (r) => r.name },
        { header: 'Hours', value: (r) => r.hours },
      ],
    );
    expect(csv).toBe('Name,Hours\r\nStudent A,3\r\n');
  });

  it('quotes cells with commas, quotes or line breaks, and leaves empty ones blank', () => {
    const csv = toCsv(
      [{ note: 'Said "hi", then left\nearly', grade: null }],
      [
        { header: 'Note', value: (r) => r.note },
        { header: 'Grade', value: (r) => r.grade },
      ],
    );
    expect(csv).toBe('Note,Grade\r\n"Said ""hi"", then left\nearly",\r\n');
  });
});

describe('parseCsv and csvToObjects', () => {
  it('reads quoted cells, doubled quotes, both line endings and a BOM', () => {
    const text = '\uFEFFname,note\r\n"Smith, Jo","Said ""hi"""\nAli,\n\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'note'],
      ['Smith, Jo', 'Said "hi"'],
      ['Ali', ''],
    ]);
  });

  it('keys each row by the header, trimmed and lower-case', () => {
    expect(csvToObjects('Name , Email\n Jo , jo@school.example ')).toEqual([
      { name: 'Jo', email: 'jo@school.example' },
    ]);
  });

  it('writes what it reads back the same', () => {
    const rows = [{ a: 'x, y', b: 'say "hi"' }];
    const csv = toCsv(rows, [
      { header: 'a', value: (r) => r.a },
      { header: 'b', value: (r) => r.b },
    ]);
    expect(csvToObjects(csv)).toEqual(rows);
  });
});
