// The search field: a real <form role="search"> with a labelled input.
// Results follow as you type (useSearchAsYouType); pressing Enter (or the
// keyboard's Search key) searches straight away. The field also reports when
// a Japanese, Chinese or Korean keyboard is composing a word, so the search
// can wait for the finished word.
import type { FormEvent, KeyboardEvent, Ref } from 'react';
import { Icon } from '@/components/Icon';
import styles from './SearchField.module.css';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter: search now. */
  onSubmit: () => void;
  onCompositionStart: () => void;
  /** Called with the field's value once the word is finished. */
  onCompositionEnd: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}

export function SearchField({
  value,
  onChange,
  onSubmit,
  onCompositionStart,
  onCompositionEnd,
  inputRef,
}: SearchFieldProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  // On those keyboards Enter confirms the word being composed; it isn't a
  // search. Safari ends the composition first and then sends the Enter, which
  // is why the keyCode 229 ("an input method handled this key") check is here.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) event.preventDefault();
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
        onKeyDown={handleKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={(event) => onCompositionEnd(event.currentTarget.value)}
      />
    </form>
  );
}
