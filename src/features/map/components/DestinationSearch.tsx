// "Where to?": search as you type over the indoor map's named rooms, open
// areas and entrances (searchableDestinations: unnamed rooms aren't listed).
// Each result shows the name, its class or teacher, and the floor. The same
// box picks the start when a student says which classroom they're nearest.
// Looks like the old map's room search.
import { useId, useState } from 'react';
import { Icon } from '@/components/Icon';
import type { Destination } from '../nav/assignments';
import { floorLabel } from '../nav/routeView';
import { searchDestinations } from '../nav/search';
import styles from './DestinationSearch.module.css';

interface DestinationSearchProps {
  destinations: Destination[];
  /** Visible placeholder and the box's accessible name. */
  label: string;
  onPick: (destination: Destination) => void;
  /**
   * Glass over the map (default), or plain inside a panel. Inside a panel the
   * matches are listed in the panel itself: a pop-over would be cut off by
   * the panel's edges.
   */
  plain?: boolean;
  autoFocus?: boolean;
}

const kindLabel: Record<Destination['kind'], string> = {
  room: '',
  place: 'Open area',
  entrance: 'Entrance',
};

export function DestinationSearch({
  destinations,
  label,
  onPick,
  plain = false,
  autoFocus = false,
}: DestinationSearchProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const matches = searchDestinations(destinations, query);

  return (
    <div className={styles.wrap}>
      <div className={plain ? `${styles.box} ${styles.plain}` : `glass ${styles.box}`}>
        <Icon name="search" size={18} />
        <label htmlFor={id} className="visually-hidden">
          {label}
        </label>
        <input
          id={id}
          type="search"
          className={styles.input}
          placeholder={label}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          // Escape closes the matches in every browser (only some clear a
          // search box on their own).
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              event.preventDefault();
              setQuery('');
            }
          }}
        />
      </div>
      {query.trim() && (
        <ul
          className={plain ? styles.inline : `glass thick ${styles.results}`}
          aria-label={`${label}: matches`}
        >
          {matches.length === 0 && (
            <li className={styles.none}>Nothing matches “{query.trim()}”</li>
          )}
          {matches.map((destination) => {
            const detail = [kindLabel[destination.kind], destination.subject, destination.teacher]
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={destination.roomId}>
                <button
                  type="button"
                  className={styles.result}
                  onClick={() => {
                    onPick(destination);
                    setQuery('');
                  }}
                >
                  <span className={styles.text}>
                    <span className={styles.name}>{destination.name}</span>
                    {detail && <span className={styles.detail}>{detail}</span>}
                  </span>
                  <span className={styles.floor}>{floorLabel(destination.floor)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
