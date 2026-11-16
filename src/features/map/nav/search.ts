// Search as you type over the map's named rooms, open areas and entrances.
//
// Forgiving on purpose, because people type names the way they say them:
//   * spaces, dots and dashes don't matter ("kg2b" finds "KG2 B",
//     "pyp 3b" finds "PYP3 B");
//   * the words can come in any order ("lab chem" finds "Chem Lab");
//   * one slip in a longer word is fine ("chemstry" finds "Chemistry").
// Ranked so the obvious answer comes first: names that start with what was
// typed, then a word that starts with it, then a match anywhere, then the
// class, subject or teacher, then near misses. Ties are alphabetical, with
// numbers in number order ("DP 2" before "DP 10").
import type { Destination } from './assignments.ts';

export const SEARCH_LIMIT = 8;

/** Lower case, letters and digits only: "KG2 B" -> "kg2b". */
export const compact = (text: string) =>
  text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Edit distance, stopping early once it is over `max` (only small ones matter). */
function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      best = Math.min(best, current[j]);
    }
    if (best > max) return false;
    previous = current;
  }
  return previous[b.length] <= max;
}

function rank(destination: Destination, query: string): number | null {
  const q = compact(query);
  if (q === '') return null;
  const name = compact(destination.name);
  const nameWords = words(destination.name);
  const other = compact(`${destination.subject} ${destination.teacher}`);

  if (name.startsWith(q)) return 0;
  if (nameWords.some((word) => word.startsWith(q))) return 1;
  if (name.includes(q)) return 2;

  // Every word typed appears somewhere, in any order.
  const typed = words(query);
  const everything = `${name} ${other}`;
  if (typed.length > 1 && typed.every((word) => everything.includes(word))) return 3;
  if (other.includes(q)) return 4;

  // A near miss: one slip (two in long words) against the start of the name
  // or against a whole word of it. Short queries are left out: too noisy.
  if (q.length >= 4) {
    const allowed = q.length >= 8 ? 2 : 1;
    const start = name.slice(0, q.length);
    if (withinEdits(q, start, allowed)) return 5;
    if (nameWords.some((word) => word.length >= 4 && withinEdits(q, word, allowed))) return 5;
  }
  return null;
}

export function searchDestinations(
  list: Destination[],
  query: string,
  limit = SEARCH_LIMIT,
): Destination[] {
  if (compact(query) === '') return [];
  return list
    .map((destination) => ({ destination, score: rank(destination, query) }))
    .filter((hit): hit is { destination: Destination; score: number } => hit.score !== null)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.destination.name.localeCompare(b.destination.name, undefined, { numeric: true }),
    )
    .slice(0, limit)
    .map((hit) => hit.destination);
}
