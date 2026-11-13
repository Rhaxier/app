// Names the screen in the browser tab (and for screen readers on page change):
// "Campus map · School App". PageHeader calls it for every screen with a
// header; screens without one (the map, the booking screen) call it themselves.
import { useEffect } from 'react';
import { school } from '@/config/school';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${school.appName}`;
  }, [title]);
}
