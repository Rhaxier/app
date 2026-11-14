// The search field: a real <form role="search"> with a labelled input.
// Pressing Enter (or the keyboard's Search key) searches straight away.
import type { FormEvent, Ref } from 'react';
import { Icon } from '@/components/Icon';
import styles from './SearchField.module.css';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter: search now. */
  onSubmit: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

export function SearchField({ value, onChange, onSubmit, inputRef }: SearchFieldProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form role="search" className={styles.box} onSubmit={handleSubmit}>
      <Icon name="search" size={18} />
      <label htmlFor="search-field" className="visually-hidden">
        Search rooms, events, posts
      </label>
      <input
        ref={inputRef}
        id="search-field"
        type="search"
        className={styles.input}
        placeholder="Search rooms, events, posts"
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </form>
  );
}
