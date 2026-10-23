// Fix-it reports: the form's checks and the text on the map card. Reporter
// privacy, the urgent flag and routing are tested in the database:
// supabase/tests/08_fixit_test.sql.
import { describe, expect, it } from 'vitest';
import {
  reportLabel,
  reportSummary,
  reportTitle,
  toReportInput,
  validateReport,
  type ReportFormValues,
} from './logic';

const valid: ReportFormValues = {
  roomId: 'room-1',
  category: 'it',
  description: "Projector won't turn on",
  urgent: false,
  photo: null,
};

function file(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('validateReport', () => {
  it('accepts a complete report', () => {
    expect(validateReport(valid)).toEqual({});
  });

  it('needs a room, a category and a few words', () => {
    expect(validateReport({ ...valid, roomId: '', category: '', description: 'x' })).toEqual({
      roomId: 'Choose the room.',
      category: 'Choose what kind of problem it is.',
      description: 'Describe the problem in a few words.',
    });
  });

  it('only takes images up to 5 MB', () => {
    expect(
      validateReport({ ...valid, photo: file('notes.pdf', 'application/pdf', 10) }).photo,
    ).toBe('Choose a photo (an image file).');
    expect(
      validateReport({ ...valid, photo: file('big.jpg', 'image/jpeg', 6 * 1024 * 1024) }).photo,
    ).toBe('Photos can be up to 5 MB.');
    expect(validateReport({ ...valid, photo: file('ok.jpg', 'image/jpeg', 1000) })).toEqual({});
  });

  it('trims the description for the database', () => {
    expect(toReportInput({ ...valid, description: '  Leaking tap  ' }).description).toBe(
      'Leaking tap',
    );
  });
});

describe('the map card text', () => {
  const now = new Date('2026-10-19T08:00:00Z');

  it('reads like the mockup', () => {
    expect(reportLabel({ room_code: 'G.15', category_name: 'IT' })).toBe('Fix-it · Room G.15');
    expect(reportLabel({ room_code: null, category_name: 'Air conditioning' })).toBe(
      'Fix-it · Air conditioning',
    );
    expect(
      reportSummary({ created_at: '2026-10-19T05:00:00Z', routed_to: 'facilities' }, now),
    ).toBe('Reported today · Sent to facilities');
    expect(reportSummary({ created_at: '2026-10-18T05:00:00Z', routed_to: 'it' }, now)).toBe(
      'Reported yesterday · Sent to IT',
    );
  });

  it('uses the first line of the description as the title, shortened', () => {
    expect(reportTitle('Broken chair\nBy the window')).toBe('Broken chair');
    expect(reportTitle('a'.repeat(80), 20)).toBe(`${'a'.repeat(19)}…`);
  });
});
