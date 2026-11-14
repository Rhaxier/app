// The search field and its results, shared by the search overlay (the search
// button, ⌘K) and the /search screen. It searches what the app already has
// loaded (rooms, volunteering events, announcements, collab posts), grouped
// by kind. New results fade up one after another (a 35ms stagger); results
// already showing stay still while you refine the search.
import { motion } from 'motion/react';
import { useState, type Ref } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeader } from '@/components/PageHeader';
import { EmptyState, LoadingState } from '@/components/States';
import { distance, spring } from '@/lib/motion';
import { useSearchSources } from '../hooks';
import { searchAll } from '../logic';
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

export function SearchPanel({ initialQuery = '', onSearch, onPick, inputRef }: SearchPanelProps) {
  const [draft, setDraft] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const { sources, loading } = useSearchSources();
  const groups = searchAll(query, sources);

  function search(text: string) {
    setQuery(text);
    onSearch?.(text);
  }

  return (
    <div className={styles.panel}>
      <SearchField
        value={draft}
        onChange={setDraft}
        onSubmit={() => search(draft.trim())}
        inputRef={inputRef}
      />
      <div className={styles.results} aria-live="polite">
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
