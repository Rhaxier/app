// Every room, open area and entrance on all floors, named or not, with a
// search box and filters. Each row is a real button, so the whole list works
// from the keyboard; picking one selects it on the map too. When a room is
// picked on the map instead, its row scrolls into view.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChipGroup, FilterChip } from '@/components/Chip';
import { TextField } from '@/components/Input';
import { filterRoomRows, type RoomFilter, type RoomRow } from '@/features/map/nav/assignments';
import { floorLabel, kindLabel, roomTypeLabel } from './labels';
import styles from './MapRooms.module.css';

interface RoomTableProps {
  rows: RoomRow[];
  floors: string[];
  selectedId: string | null;
  onPick: (row: RoomRow) => void;
  /** Scrolls this row into view when `seq` changes (a pick on the map). */
  scrollTo: { id: string; seq: number } | null;
}

export function RoomTable({ rows, floors, selectedId, onPick, scrollTo }: RoomTableProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RoomFilter>('all');
  const shown = useMemo(() => filterRoomRows(rows, query, filter), [rows, query, filter]);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const namedCount = rows.filter((row) => row.name !== '').length;

  useEffect(() => {
    if (!scrollTo) return;
    rowRefs.current.get(scrollTo.id)?.scrollIntoView({ block: 'nearest' });
    // Only a new pick on the map scrolls; typing in the search must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo?.seq]);

  const filters: { value: RoomFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'named', label: 'Named' },
    { value: 'unnamed', label: 'Unnamed' },
    ...floors.map((floor) => ({ value: `floor:${floor}` as RoomFilter, label: floorLabel(floor) })),
  ];

  return (
    <section className="stack-tight" aria-label="Rooms">
      <TextField
        label="Search rooms"
        type="search"
        placeholder="Name, class, teacher or id"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ChipGroup label="Show">
        {filters.map((option) => (
          <FilterChip
            key={option.value}
            selected={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </FilterChip>
        ))}
      </ChipGroup>
      <p className="meta" aria-live="polite">
        {shown.length} shown · {namedCount} of {rows.length} named
      </p>
      {shown.length === 0 ? (
        <p className="meta">No rooms match.</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((row) => {
            const selected = row.id === selectedId;
            const detail = [
              kindLabel[row.kind],
              floorLabel(row.floor),
              row.name ? roomTypeLabel[row.type] : null,
              row.subject || null,
              row.teacher || null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={row.id}>
                <button
                  type="button"
                  ref={(element) => {
                    if (element) rowRefs.current.set(row.id, element);
                    else rowRefs.current.delete(row.id);
                  }}
                  className={[styles.rowButton, selected && styles.rowSelected]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={selected}
                  onClick={() => onPick(row)}
                >
                  <span
                    className={[styles.rowName, !row.name && styles.rowUnnamed]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {row.name || 'No name'}
                  </span>
                  <span className={styles.rowId}>{row.id}</span>
                  <span className={styles.rowDetail}>{detail}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
