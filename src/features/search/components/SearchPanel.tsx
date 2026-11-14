// The search field and its results, shared by the search overlay (the search
// button, ⌘K) and the /search screen. It searches what the app already has
// loaded (rooms, volunteering events, announcements, collab posts), grouped
// by kind, as you type (useSearchAsYouType: a 150ms pause, or Enter).
// New results fade up one after another (a 35ms stagger); results already
// showing stay still while you refine the search.
//
// The states, in order: nothing typed yet (what you can search), the lists
// still loading, nothing found, and the results. A screen reader hears a
// short summary ("4 results") rather than every result being read out.
import { motion } from 'motion/react';
import type { Ref } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeader } from '@/components/PageHeader';
import { EmptyState, LoadingState } from '@/components/States';
import { distance, spring } from '@/lib/motion';
import { useSearchAsYouType, useSearchSources } from '../hooks';
import { searchAll, type SearchGroup } from '../logic';
import { SearchField } from './SearchField';
import styles from './SearchPanel.module.css';

interface SearchPanelProps {
  initialQuery?: string;
  /** Called with each query as it's searched (the /search screen keeps it in the address). */
  onSearch?: (query: string) => void;
  /** Called when a result is chosen (the overlay closes). */
  onPick?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

/** What a screen reader hears after each search. */
function statusText(query: string, loading: boolean, groups: SearchGroup[]): string {
  if (!query) return '';
  if (loading) return 'Searching…';
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  if (count === 0) return `Nothing found for “${query}”`;
  return count === 1 ? '1 result' : `${count} results`;
}

export function SearchPanel({ initialQuery = '', onSearch, onPick, inputRef }: SearchPanelProps) {
  const typing = useSearchAsYouType(initialQuery, onSearch);
  const { query } = typing;
  const { sources, loading } = useSearchSources();
  const groups = searchAll(query, sources);

  return (
    <div className={styles.panel}>
      <SearchField
        value={typing.draft}
        onChange={typing.type}
        onSubmit={typing.submit}
        onCompositionStart={typing.compositionStart}
        onCompositionEnd={typing.compositionEnd}
        inputRef={inputRef}
      />
      <p role="status" className="visually-hidden">
        {statusText(query, loading, groups)}
      </p>
      <div className={styles.results}>
        {!query && (
          <EmptyState icon="search" title="Search the whole app">
            Rooms, volunteering events, announcements and collab posts.
          </EmptyState>
        )}
        {loading && query && <LoadingState shape="row" count={3} />}
        {!loading && query && groups.length === 0 && (
          <EmptyState icon="search" title={`Nothing found for “${query}”`}>
            Try a room code like G.06, or part of a title.
          </EmptyState>
        )}
        {groups.map((group) => (
          <section
            key={group.kind}
            className="stack-tight"
            aria-labelledby={`search-${group.kind}`}
          >
            <SectionHeader id={`search-${group.kind}`} title={group.label} />
            <ul className={styles.list}>
              {group.items.map((item, index) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, y: distance.shift }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.page, delay: index * 0.035 }}
                >
                  <Link to={item.to} className={`${styles.result} pressable`} onClick={onPick}>
                    <span className={styles.title}>{item.title}</span>
                    {item.detail && <span className="meta">{item.detail}</span>}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
