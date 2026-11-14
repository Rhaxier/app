// "Find a room": type part of a code or name, pick from the matches. On the
// map it floats over the plan as a glass search bar (Regular glass, radius 26).
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import type { Room } from '../api';
import { searchRooms } from '../logic';
import styles from './RoomSearch.module.css';

interface RoomSearchProps {
  rooms: Room[];
  floorName: (floorId: string) => string;
  onPick: (room: Room) => void;
}

export function RoomSearch({ rooms, floorName, onPick }: RoomSearchProps) {
  const [query, setQuery] = useState('');
  const matches = searchRooms(rooms, query);

  return (
    <div className={styles.wrap}>
      <div className={`glass ${styles.box}`}>
        <Icon name="search" size={18} />
        <label htmlFor="room-search" className="visually-hidden">
          Find a room
        </label>
        <input
          id="room-search"
          type="search"
          className={styles.input}
          placeholder="Find a room"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {query.trim() && (
        <ul className={`glass thick ${styles.results}`} aria-label="Matching rooms">
          {matches.length === 0 && <li className={styles.none}>No rooms match “{query.trim()}”</li>}
          {matches.map((room) => (
            <li key={room.id}>
              <button
                type="button"
                className={styles.result}
                onClick={() => {
                  onPick(room);
                  setQuery('');
                }}
              >
                <span className={styles.code}>{room.code}</span>
                <span className={styles.name}>{room.name}</span>
                <span className="meta">Floor {floorName(room.floor_id)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
