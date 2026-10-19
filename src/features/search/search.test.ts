import { describe, expect, it } from 'vitest';
import { matches, searchAll } from './logic';

const item = (id: string) => ({ id, title: id, detail: '', to: `/${id}` });

describe('search', () => {
  it('needs every word, in any order, ignoring case', () => {
    expect(matches('Lab 1 (placeholder) G.06', 'g.06 lab')).toBe(true);
    expect(matches('Lab 1 (placeholder) G.06', 'lab library')).toBe(false);
  });

  it('groups results by kind and drops empty groups', () => {
    const groups = searchAll('lab', {
      rooms: [
        { item: item('lab1'), text: 'Lab 1' },
        { item: item('library'), text: 'Library' },
      ],
      events: [],
      announcements: [{ item: item('a1'), text: 'Lab safety reminder' }],
      collab: [],
    });
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Rooms', ['lab1']],
      ['Announcements', ['a1']],
    ]);
  });

  it('returns nothing for an empty query', () => {
    expect(searchAll('  ', { rooms: [], events: [], announcements: [], collab: [] })).toEqual([]);
  });
});
