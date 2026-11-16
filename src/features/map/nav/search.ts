// Search as you type over the map's named rooms, open areas and entrances.
//
// Ranked so the obvious answer comes first: a name that starts with what was
// typed ("12" -> "12 B"), then a word in the name that starts with it
// ("lab" -> "Chem Lab"), then a match anywhere in the name, class/subject or
// teacher. Ties keep alphabetical order.
import type { Destination } from './assignments.ts';

export const SEARCH_LIMIT = 8;

function rank(destination: Destination, query: string): number | null {
  const name = destination.name.toLowerCase();
  if (name.startsWith(query)) return 0;
  if (name.split(/[\s\-/&(]+/).some((word) => word.startsWith(query))) return 1;
  if (name.includes(query)) return 2;
  const other = `${destination.subject} ${destination.teacher}`.toLowerCase();
  if (other.includes(query)) return 3;
  return null;
}

export function searchDestinations(
  list: Destination[],
  query: string,
  limit = SEARCH_LIMIT,
): Destination[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return list
    .map((destination) => ({ destination, score: rank(destination, q) }))
    .filter((hit): hit is { destination: Destination; score: number } => hit.score !== null)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.destination.name.localeCompare(b.destination.name, undefined, { numeric: true }),
    )
    .slice(0, limit)
    .map((hit) => hit.destination);
}
