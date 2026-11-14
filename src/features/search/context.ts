// The search overlay's state, shared through the app (SearchOverlayProvider):
// is it open, and what opened it. The origin decides how it appears:
//   button    the round search button: the overlay grows out of it
//   link      any other search button: it scales up from the middle
//   keyboard  ⌘K / Ctrl+K: no animation at all, because a shortcut used many
//             times a day should be instant
import { createContext } from 'react';

export type SearchOrigin = 'button' | 'link' | 'keyboard';

export interface SearchOverlayState {
  open: boolean;
  origin: SearchOrigin;
  openSearch: (origin: SearchOrigin) => void;
  closeSearch: () => void;
}

export const SearchOverlayContext = createContext<SearchOverlayState | null>(null);

/** Shared by the search button and the overlay, so one can morph into the other. */
export const SEARCH_MORPH_ID = 'search-surface';
