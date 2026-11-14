// Holds the search overlay's state for the whole signed-in app, draws the
// overlay, and listens for ⌘K / Ctrl+K ("⌘K jumps anywhere", design PDF
// page 9). The overlay closes by itself when the screen changes, e.g. after
// choosing a result or tapping a tab.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SearchOverlay } from './components/SearchOverlay';
import { SearchOverlayContext, type SearchOrigin, type SearchOverlayState } from './context';

export function SearchOverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; origin: SearchOrigin }>({
    open: false,
    origin: 'button',
  });

  // A new screen closes it. ("Adjust state while rendering": no extra frame.)
  const { pathname } = useLocation();
  const [shownOn, setShownOn] = useState(pathname);
  if (shownOn !== pathname) {
    setShownOn(pathname);
    if (state.open) setState((current) => ({ ...current, open: false }));
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setState({ open: true, origin: 'keyboard' });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo<SearchOverlayState>(
    () => ({
      ...state,
      openSearch: (origin) => setState({ open: true, origin }),
      closeSearch: () => setState((current) => ({ ...current, open: false })),
    }),
    [state],
  );

  return (
    <SearchOverlayContext.Provider value={value}>
      {children}
      <SearchOverlay open={state.open} origin={state.origin} onClose={value.closeSearch} />
    </SearchOverlayContext.Provider>
  );
}
