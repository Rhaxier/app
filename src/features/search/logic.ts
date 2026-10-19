// Search: one query over things the app already has, grouped by kind.
// Plain function, tested in search.test.ts.

export interface SearchItem {
  id: string;
  title: string;
  detail: string;
  to: string;
}

export interface SearchGroup {
  kind: 'rooms' | 'events' | 'announcements' | 'collab';
  label: string;
  items: SearchItem[];
}

/** Every word of the query must appear somewhere in the item's text. */
export function matches(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function searchAll(
  query: string,
  sources: Record<SearchGroup['kind'], { item: SearchItem; text: string }[]>,
  limitPerGroup = 5,
): SearchGroup[] {
  if (!query.trim()) return [];
  const labels: Record<SearchGroup['kind'], string> = {
    rooms: 'Rooms',
    events: 'Volunteering',
    announcements: 'Announcements',
    collab: 'Collab posts',
  };
  return (Object.keys(labels) as SearchGroup['kind'][])
    .map((kind) => ({
      kind,
      label: labels[kind],
      items: sources[kind]
        .filter((source) => matches(source.text, query))
        .map((source) => source.item)
        .slice(0, limitPerGroup),
    }))
    .filter((group) => group.items.length > 0);
}
