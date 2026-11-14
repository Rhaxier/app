// Search as you type: the results follow the field after a 150ms pause,
// straight away on Enter, and not while a Japanese, Chinese or Korean
// keyboard is still composing a word. The search lists are replaced with a
// fixed sample, so these tests need no database.
//
// The clock is faked so the tests can step through the 150ms exactly. That's
// why typing uses fireEvent (one event at a time, no waiting) rather than
// userEvent, whose async steps wait on a real timer that the fake clock stops.
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { SearchPanel } from './components/SearchPanel';
import { SEARCH_DELAY_MS } from './hooks';
import type { SearchSources } from './logic';

const sources: SearchSources = {
  rooms: [
    {
      item: { id: 'lab1', title: 'G.06 · Lab 1', detail: 'On the map', to: '/map?room=G.06' },
      text: 'G.06 Lab 1',
    },
  ],
  events: [],
  announcements: [],
  collab: [],
};

vi.mock('./hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks')>()),
  useSearchSources: () => ({ sources, loading: false }),
}));

describe('search as you type', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const onSearch = vi.fn();
    renderWithProviders(<SearchPanel onSearch={onSearch} />);
    const field = screen.getByLabelText<HTMLInputElement>('Search rooms, events, posts');
    /** Type `text` one letter at a time, as a person would. */
    function type(text: string) {
      for (const letter of text)
        fireEvent.change(field, { target: { value: field.value + letter } });
    }
    /** Press Enter (the form submits). */
    function enter() {
      fireEvent.submit(field.closest('form')!);
    }
    return { onSearch, field, type, enter };
  }

  it('says what can be searched before anything is typed', () => {
    setup();
    expect(screen.getByText('Search the whole app')).toBeInTheDocument();
  });

  it('shows results once typing pauses for 150ms', () => {
    const { onSearch, type } = setup();
    type('lab');
    expect(screen.queryByText('G.06 · Lab 1')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(SEARCH_DELAY_MS - 1));
    expect(screen.queryByText('G.06 · Lab 1')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('G.06 · Lab 1')).toBeInTheDocument();
    // The short summary a screen reader hears.
    expect(screen.getByText('1 result')).toBeInTheDocument();
    // One search for the whole word, not one per letter.
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('lab');
  });

  it('searches straight away on Enter', () => {
    const { type, enter } = setup();
    type('lab');
    enter();
    expect(screen.getByText('G.06 · Lab 1')).toBeInTheDocument();
  });

  it('says when nothing matches', () => {
    const { type, enter } = setup();
    type('zebra');
    enter();
    expect(screen.getByText('Try a room code like G.06, or part of a title.')).toBeInTheDocument();
  });

  it('waits for a word being composed on a Japanese, Chinese or Korean keyboard', () => {
    const { onSearch, field } = setup();
    fireEvent.compositionStart(field);
    fireEvent.change(field, { target: { value: 'ら' } });
    act(() => vi.advanceTimersByTime(1000));
    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: 'ラボ' } });
    fireEvent.compositionEnd(field);
    act(() => vi.advanceTimersByTime(SEARCH_DELAY_MS));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('ラボ');
  });
});
