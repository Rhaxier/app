// The search field on Home. Submitting opens the search screen with the query.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import styles from './SearchBox.module.css';

export function SearchBox({ initialQuery = '' }: { initialQuery?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <form role="search" className={styles.box} onSubmit={handleSubmit}>
      <Icon name="search" size={20} />
      <label htmlFor="home-search" className="visually-hidden">
        Search rooms, events, people
      </label>
      <input
        id="home-search"
        type="search"
        className={styles.input}
        placeholder="Search rooms, events, people"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
    </form>
  );
}
