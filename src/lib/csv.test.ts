import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

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
